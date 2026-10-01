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
import { Section } from "../components/Section.tsx";
import { Badge } from "../components/ui/badge.tsx";
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
      <PageContainer className="p-2 md:px-6">
        <div className="flex w-full max-w-prose flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">That activity doesn't exist here.</p>
          <Button render={<Link to="/" />} nativeButton={false} variant="outline" size="sm">
            Back to dashboard
          </Button>
        </div>
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
    <PageContainer className="p-2 pb-10 md:px-6">
      <div className="flex w-full max-w-prose flex-col items-start gap-4">
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back to dashboard
        </Link>

        <header className="flex w-full flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2">
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
            </div>
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

          <div className="flex flex-wrap gap-1.5">
            <Badge>{activity.persistent ? "Ongoing" : "One-off"}</Badge>
            <Badge>
              {activity.slotGranularity === "day" ? "Any time that day" : "Specific hours"}
            </Badge>
            {activity.endTime && (
              <Badge variant={closed ? "outline" : "secondary"}>
                {closed ? "Closed" : "Respond by"} {formatDeadline(activity.endTime)}
              </Badge>
            )}
            {activity.idealMemberCount && <Badge>Aiming for {activity.idealMemberCount}</Badge>}
            {bookings.length > 0 && <Badge variant="success">{bookings.length} booked</Badge>}
          </div>
        </header>

        <Section
          title={closed ? "Your response" : "When can you make it?"}
          description={
            closed
              ? "Responses are closed."
              : activity.slotGranularity === "day"
                ? "Pick the days that work for you."
                : "Drag across the hours you're free."
          }
        >
          {declined && !closed && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
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
        </Section>

        <Section title="Who can make it" description="Everyone's answers, day by day.">
          <ResponderBreakdown activity={activity} />
        </Section>

        {activity.persistent && (
          <Section title="Locations" description="Places this happens, ready to pick when booking.">
            <ActivityLocations activity={activity} canEdit={isOwner} />
          </Section>
        )}

        <Section
          title="Bookings"
          description={bookings.length > 0 ? undefined : "Nothing booked yet."}
        >
          {bookings.length > 0 && (
            <ul className="flex flex-col gap-2">
              {bookings.map((booking) => (
                <li
                  key={booking.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-green-600/30 bg-green-600/10 p-3"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
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
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </PageContainer>
  );
};

export const Route = createFileRoute("/activities/$activityId")({
  component: ActivityDetail,
});
