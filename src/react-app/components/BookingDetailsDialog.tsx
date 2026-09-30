import type { ReactElement } from "react";

import type { ActivityWithAvailability } from "../queries/activities.ts";
import { useSessionQuery } from "../queries/session.ts";
import { AddBookingDialog } from "./AddBookingDialog.tsx";
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
};

export const BookingDetailsDialog = ({ activityId, booking, trigger }: Props) => {
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
          <p>
            <span className="text-muted-foreground">Booked by</span> {booking.createdByName}
          </p>
          <p>
            <span className="text-muted-foreground">Joining:</span>{" "}
            {booking.attendeeNames.length > 0
              ? booking.attendeeNames.join(", ")
              : "No one else yet."}
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
          {isOwner && (
            <AddBookingDialog
              activityId={activityId}
              booking={{
                id: booking.id,
                date: booking.date,
                from: booking.from,
                to: booking.to,
                attendeeUserIds: booking.attendeeUserIds,
                guestNames: booking.guestNames,
              }}
              trigger={<Button type="button">Edit</Button>}
            />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
