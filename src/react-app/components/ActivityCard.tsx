import { Link } from "@tanstack/react-router";
import { CheckIcon, PencilIcon } from "lucide-react";

import { isRespondByPassed } from "../lib/activity-state.ts";
import { splitByResponse } from "../lib/responders.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";
import { useChannelMembersQuery } from "../queries/channelMembers.ts";
import { useSessionQuery } from "../queries/session.ts";
import { BookingDetailsDialog } from "./BookingDetailsDialog.tsx";
import { EditActivityDialog } from "./EditActivityDialog.tsx";
import { Button } from "./ui/button.tsx";

const MAX_NAMES = 3;

const summarize = (activity: ActivityWithAvailability) => {
  if (activity.declined) return "You can't make it";
  if (activity.slots.length === 0) return "Not answered yet";

  const days = new Set(activity.slots.map((slot) => slot.date)).size;
  return `You're in for ${days} day${days === 1 ? "" : "s"}`;
};

/** First few names in full, the rest as a count — the whole list is a click
 * away on the activity's page. */
const nameSummary = (names: string[]) => {
  if (names.length <= MAX_NAMES) return names.join(", ");
  return `${names.slice(0, MAX_NAMES).join(", ")} +${names.length - MAX_NAMES}`;
};

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const formatBookingDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const formatDeadline = (endTime: string) =>
  new Date(endTime).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

type Props = {
  activity: ActivityWithAvailability;
};

export const ActivityCard = ({ activity }: Props) => {
  const isBooked = activity.bookings.length > 0;
  const { data } = useSessionQuery();
  const members = useChannelMembersQuery();
  const isOwner = data?.session?.userId === activity.createdBy;

  const { available, declined } = splitByResponse(activity.responses, members.data ?? []);

  const closed = isRespondByPassed(activity);

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              to="/activities/$activityId"
              params={{ activityId: activity.id }}
              className="font-medium hover:underline"
            >
              {activity.title}
            </Link>
            {isOwner && (
              <EditActivityDialog
                activity={activity}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit activity"
                    className="size-5 text-muted-foreground"
                  >
                    <PencilIcon className="size-3.5" />
                  </Button>
                }
              />
            )}
          </div>
          {activity.description && (
            <p className="text-sm text-muted-foreground">{activity.description}</p>
          )}
          {activity.suggestedDates && activity.suggestedDates.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Suggested: {activity.suggestedDates.map(formatDate).join(", ")}
            </p>
          )}
        </div>
        {activity.endTime && !isBooked && (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            Respond by {formatDeadline(activity.endTime)}
          </span>
        )}
      </div>

      {isBooked ? (
        <div className="flex flex-col gap-2 rounded-md border border-green-600/30 bg-green-600/10 p-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
            <CheckIcon className="size-4" />
            Booked
          </div>
          {activity.bookings.map((booking) => (
            <div key={booking.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p>
                  {formatBookingDate(booking.date)} · {booking.from}–{booking.to}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Going
                  {activity.idealMemberCount
                    ? ` (${booking.attendeeNames.length}/${activity.idealMemberCount})`
                    : ` (${booking.attendeeNames.length})`}
                  {booking.attendeeNames.length > 0
                    ? `: ${booking.attendeeNames.join(", ")}`
                    : ": no one else yet."}
                </p>
              </div>
              <BookingDetailsDialog
                activityId={activity.id}
                booking={booking}
                idealMemberCount={activity.idealMemberCount}
                from="home"
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    Details
                  </Button>
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col text-sm text-muted-foreground">
            <span>
              {available.length > 0
                ? activity.idealMemberCount
                  ? `${available.length}/${activity.idealMemberCount} in`
                  : `${available.length} in`
                : "No one in yet"}
              {declined.length > 0 && ` · ${declined.length} can't make it`}
              {" · "}
              {summarize(activity)}
            </span>
            {available.length > 0 && (
              <span className="truncate text-xs">
                {nameSummary(available.map((responder) => responder.name))}
              </span>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              render={<Link to="/activities/$activityId" params={{ activityId: activity.id }} />}
              variant="outline"
              size="sm"
            >
              {closed
                ? "View responses"
                : activity.declined
                  ? "Can't make it"
                  : activity.slots.length > 0
                    ? "Edit availability"
                    : "I'm in"}
            </Button>
            <Button
              render={
                <Link
                  to="/activities/$activityId/book"
                  params={{ activityId: activity.id }}
                  search={{ from: "home" }}
                />
              }
              size="sm"
            >
              Book
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
