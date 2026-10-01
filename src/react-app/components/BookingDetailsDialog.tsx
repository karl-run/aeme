import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { isUrl } from "../lib/is-url.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";
import { useSessionQuery } from "../queries/session.ts";
import { Button } from "./ui/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog.tsx";

type BookingSummary = ActivityWithAvailability["bookings"][number];

const formatFullDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

type Props = {
  activityId: string;
  booking: BookingSummary;
  trigger: ReactElement;
  /** Advisory headcount, shown alongside the attendee count as "N/ideal". */
  idealMemberCount?: number | null;
  /** Where the edit link should return to once it's done. */
  from: "home" | "activity";
};

export const BookingDetailsDialog = ({
  activityId,
  booking,
  trigger,
  idealMemberCount,
  from,
}: Props) => {
  const { data } = useSessionQuery();
  const isOwner = data?.session?.userId === booking.createdBy;

  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formatFullDate(booking.date)}</DialogTitle>
          <DialogDescription>
            {booking.from}–{booking.to}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 text-sm">
          {booking.description && <p>{booking.description}</p>}
          {booking.fixedLocation ? (
            <p>
              <span className="text-muted-foreground">Location:</span>{" "}
              <a
                href={booking.fixedLocation.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {booking.fixedLocation.name}
              </a>
            </p>
          ) : (
            booking.location && (
              <p>
                <span className="text-muted-foreground">Location:</span>{" "}
                {isUrl(booking.location) ? (
                  <a href={booking.location} target="_blank" rel="noreferrer" className="underline">
                    {booking.location}
                  </a>
                ) : (
                  booking.location
                )}
              </p>
            )
          )}
          <p>
            <span className="text-muted-foreground">Booked by</span> {booking.createdByName}
          </p>
          <p>
            <span className="text-muted-foreground">
              Joining
              {idealMemberCount ? ` (${booking.attendeeNames.length}/${idealMemberCount})` : ""}:
            </span>{" "}
            {booking.attendeeNames.length > 0
              ? booking.attendeeNames.join(", ")
              : "No one else yet."}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            render={<a href={`/api/bookings/${booking.id}/ics`} />}
          >
            Add to calendar
          </Button>
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
          {isOwner && (
            <Button
              render={
                <Link
                  to="/activities/$activityId/book"
                  params={{ activityId }}
                  search={{ bookingId: booking.id, from }}
                />
              }
            >
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
