import { CheckIcon } from "lucide-react";

import type { ActivityWithAvailability } from "../queries/activities.ts";
import { AddBookingDialog } from "./AddBookingDialog.tsx";
import { AvailabilityDialog } from "./AvailabilityDialog.tsx";
import { BookingDetailsDialog } from "./BookingDetailsDialog.tsx";
import { Button } from "./ui/button.tsx";

const summarize = (activity: ActivityWithAvailability) => {
  if (activity.slots.length === 0) return "Not answered yet";

  const days = new Set(activity.slots.map((slot) => slot.date)).size;
  return `You're in for ${days} day${days === 1 ? "" : "s"}`;
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

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-medium">{activity.title}</h3>
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
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            {activity.respondentCount > 0
              ? activity.idealMemberCount
                ? `${activity.respondentCount}/${activity.idealMemberCount} responded`
                : `${activity.respondentCount} responded`
              : "No responses yet"}
            {" · "}
            {summarize(activity)}
          </span>
          <div className="flex shrink-0 gap-2">
            <AvailabilityDialog activity={activity} />
            <AddBookingDialog
              activityId={activity.id}
              trigger={
                <Button type="button" size="sm">
                  Book
                </Button>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
};
