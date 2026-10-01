import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

import { BookingForm } from "../components/BookingForm.tsx";
import { DeleteBookingDialog } from "../components/DeleteBookingDialog.tsx";
import { PageContainer } from "../components/PageContainer.tsx";
import { Section } from "../components/Section.tsx";
import { Button } from "../components/ui/button.tsx";
import { useActivitiesQuery } from "../queries/activities.ts";

/** Where to go once the booking is saved or abandoned. Booking started from
 * the dashboard returns there; started from an activity's page it returns to
 * that page, so you land back on the availability you were reading. */
type ReturnTo = "home" | "activity";

type BookSearch = {
  /** YYYY-MM-DD pre-filled into the form. */
  date?: string;
  /** Set to edit an existing booking instead of creating one. */
  bookingId?: string;
  from?: ReturnTo;
};

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

const BookActivity = () => {
  const { activityId } = Route.useParams();
  const { date, bookingId, from } = Route.useSearch();
  const navigate = useNavigate();
  const activities = useActivitiesQuery();

  const activity = activities.data?.find((candidate) => candidate.id === activityId);
  const booking = activity?.bookings.find((candidate) => candidate.id === bookingId);

  const goBack = () => {
    if (from === "activity") navigate({ to: "/activities/$activityId", params: { activityId } });
    else navigate({ to: "/" });
  };

  if (activities.isPending) return null;

  if (!activity || (bookingId !== undefined && !booking)) {
    return (
      <PageContainer className="flex max-w-2xl flex-col items-start gap-3 p-2 md:px-6">
        <p className="text-sm text-muted-foreground">
          {activity ? "That booking no longer exists." : "That activity doesn't exist here."}
        </p>
        <Button render={<Link to="/" />} nativeButton={false} variant="outline" size="sm">
          Back to dashboard
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex max-w-2xl flex-col items-start gap-4 p-2 pb-10 md:px-6">
      <button
        type="button"
        onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back
      </button>

      <header className="flex w-full flex-col gap-1">
        <h1 className="text-2xl font-semibold">{booking ? "Edit booking" : "New booking"}</h1>
        <p className="text-sm text-muted-foreground">
          {activity.title}
          {(booking || date) && ` · ${formatDate(booking ? booking.date : date!)}`}
        </p>
      </header>

      <Section>
        <BookingForm
          activity={activity}
          booking={
            booking && {
              id: booking.id,
              date: booking.date,
              from: booking.from,
              to: booking.to,
              description: booking.description,
              location: booking.location,
              locationId: booking.fixedLocation?.id ?? null,
              attendeeUserIds: booking.attendeeUserIds,
              guestNames: booking.guestNames,
            }
          }
          initialDate={date}
          onDone={goBack}
          onCancel={goBack}
        />
      </Section>

      {booking && (
        <Section
          title="Delete booking"
          description="Booked this by mistake? Deleting removes it from æme and takes the Slack post with it."
          className="border-destructive/30 bg-destructive/5"
        >
          <div>
            <DeleteBookingDialog
              activityId={activity.id}
              bookingId={booking.id}
              date={booking.date}
              from={booking.from}
              to={booking.to}
              onDeleted={goBack}
            />
          </div>
        </Section>
      )}
    </PageContainer>
  );
};

export const Route = createFileRoute("/activities/$activityId_/book")({
  // Hand-rolled rather than schema-validated: three optional strings, all of
  // which the component re-checks against real data anyway.
  validateSearch: (search: Record<string, unknown>): BookSearch => ({
    date: typeof search.date === "string" ? search.date : undefined,
    bookingId: typeof search.bookingId === "string" ? search.bookingId : undefined,
    from: search.from === "activity" ? "activity" : search.from === "home" ? "home" : undefined,
  }),
  component: BookActivity,
});
