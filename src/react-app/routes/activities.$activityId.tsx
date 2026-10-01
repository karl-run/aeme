import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ActivitySlot } from "../../worker/db/schema.ts";
import { ActivityLocations } from "../components/ActivityLocations.tsx";
import { AvailabilityGrid } from "../components/AvailabilityGrid.tsx";
import { BookingDetailsDialog } from "../components/BookingDetailsDialog.tsx";
import { EditActivityDialog } from "../components/EditActivityDialog.tsx";
import { PageContainer } from "../components/PageContainer.tsx";
import { ResponderBreakdown } from "../components/ResponderBreakdown.tsx";
import { Button } from "../components/ui/button.tsx";
import { isRespondByPassed } from "../lib/activity-state.ts";
import { respondersBySlot } from "../lib/responders.ts";
import { useActivitiesQuery } from "../queries/activities.ts";
import { useUpsertAvailabilityMutation } from "../queries/availability.ts";
import { useSessionQuery } from "../queries/session.ts";

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

const ActivityDetail = () => {
  const { activityId } = Route.useParams();
  const activities = useActivitiesQuery();
  const session = useSessionQuery();
  const upsertAvailability = useUpsertAvailabilityMutation();

  const activity = activities.data?.find((candidate) => candidate.id === activityId);

  const [slots, setSlots] = useState<ActivitySlot[]>([]);
  const [declined, setDeclined] = useState(false);
  // Guards the 10s dashboard poll from overwriting an answer mid-edit.
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!activity || dirtyRef.current) return;
    setSlots(activity.slots);
    setDeclined(activity.declined);
  }, [activity]);

  if (activities.isPending) return null;

  if (!activity) {
    return (
      <PageContainer className="flex flex-col items-start gap-3 p-2 md:px-6">
        <p className="text-sm text-muted-foreground">That activity doesn't exist here.</p>
        <Button render={<Link to="/" />} nativeButton={false} variant="outline" size="sm">
          Back to dashboard
        </Button>
      </PageContainer>
    );
  }

  const isOwner = session.data?.session?.userId === activity.createdBy;
  const closed = isRespondByPassed(activity);
  const responders = respondersBySlot(activity.responses, session.data?.session?.userId);

  const handleChange = (next: ActivitySlot[]) => {
    dirtyRef.current = true;
    setSlots(next);
    setDeclined(false);
  };

  const handleSave = () => {
    upsertAvailability.mutate(
      { activityId: activity.id, slots, declined: false },
      { onSettled: () => (dirtyRef.current = false) },
    );
  };

  const handleDecline = () => {
    dirtyRef.current = true;
    setSlots([]);
    setDeclined(true);
    upsertAvailability.mutate(
      { activityId: activity.id, slots: [], declined: true },
      { onSettled: () => (dirtyRef.current = false) },
    );
  };

  const bookings = [...activity.bookings].sort((a, b) =>
    (a.date + a.from).localeCompare(b.date + b.from),
  );

  return (
    <PageContainer className="flex flex-col items-start gap-6 p-2 md:px-6">
      <Link
        to="/"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to dashboard
      </Link>

      <section className="flex w-full flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{activity.title}</h1>
          {isOwner && (
            <EditActivityDialog
              activity={activity}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit activity"
                  className="text-muted-foreground"
                >
                  <PencilIcon className="size-4" />
                </Button>
              }
            />
          )}
        </div>
        {activity.description && (
          <p className="text-sm text-muted-foreground">{activity.description}</p>
        )}
        {activity.endTime && (
          <p className="text-xs text-muted-foreground">
            {closed ? "Responses closed " : "Respond by "}
            {formatDeadline(activity.endTime)}
          </p>
        )}
      </section>

      <section className="flex w-full flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {closed
              ? "Your response"
              : activity.slotGranularity === "day"
                ? "Pick the days you can make it"
                : "Pick the hours you're available"}
          </h2>
          <Button
            render={
              <Link
                to="/activities/$activityId/book"
                params={{ activityId: activity.id }}
                search={{ from: "activity" }}
              />
            }
            nativeButton={false}
            size="sm"
          >
            <PlusIcon className="size-4" />
            Book
          </Button>
        </div>

        {declined && !closed && (
          <p className="text-sm text-destructive">
            You've said you can't make it. Pick a day or hour below to change your mind.
          </p>
        )}

        <AvailabilityGrid
          activityId={activity.id}
          granularity={activity.slotGranularity}
          suggestedDates={activity.suggestedDates}
          value={slots}
          onChange={handleChange}
          readOnly={closed}
          responders={responders}
          bookedSlots={activity.bookedSlots}
          bookings={activity.bookings}
          idealMemberCount={activity.idealMemberCount}
        />

        {!closed && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={upsertAvailability.isPending} onClick={handleSave}>
              {upsertAvailability.isPending ? "Saving…" : "Save"}
            </Button>
            {!activity.persistent && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={upsertAvailability.isPending}
                onClick={handleDecline}
              >
                Can't make it
              </Button>
            )}
          </div>
        )}

        {upsertAvailability.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            Failed to save availability.
          </p>
        )}
      </section>

      <section className="w-full max-w-2xl">
        <ResponderBreakdown activity={activity} />
      </section>

      {activity.persistent && (
        <section className="w-full max-w-2xl">
          <ActivityLocations activity={activity} canEdit={isOwner} />
        </section>
      )}

      <section className="flex w-full max-w-2xl flex-col gap-2">
        <h2 className="text-lg font-semibold">Bookings</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing booked yet.</p>
        ) : (
          bookings.map((booking) => (
            <div
              key={booking.id}
              className="flex items-center justify-between gap-3 rounded-md border border-green-600/30 bg-green-600/10 p-3"
            >
              <div className="min-w-0 text-sm">
                <p>
                  {formatBookingDate(booking.date)} · {booking.from}–{booking.to}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {booking.attendeeNames.length > 0
                    ? `Joining: ${booking.attendeeNames.join(", ")}`
                    : "No one else joining yet."}
                </p>
              </div>
              <BookingDetailsDialog
                activityId={activity.id}
                booking={booking}
                idealMemberCount={activity.idealMemberCount}
                from="activity"
                trigger={
                  <Button type="button" variant="outline" size="sm">
                    Details
                  </Button>
                }
              />
            </div>
          ))
        )}
      </section>
    </PageContainer>
  );
};

export const Route = createFileRoute("/activities/$activityId")({
  component: ActivityDetail,
});
