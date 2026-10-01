import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { useDeleteBookingMutation } from "../queries/bookings.ts";
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

const formatFullDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

type Props = {
  activityId: string;
  bookingId: string;
  date: string;
  from: string;
  to: string;
  /** Called once it's gone — the host route navigates away, since the page
   * it was editing no longer has anything to edit. */
  onDeleted: () => void;
};

/** The undo for a booking that shouldn't exist — a wrong date, a duplicate —
 * not a way to clear out ones that already happened. It takes the Slack
 * announcement with it, which is the point: the mistake shouldn't keep
 * advertising itself in the channel. Worth a confirm step either way. */
export const DeleteBookingDialog = ({
  activityId,
  bookingId,
  date,
  from,
  to,
  onDeleted,
}: Props) => {
  const [open, setOpen] = useState(false);
  const deleteBooking = useDeleteBookingMutation();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="destructive" />}>
        <Trash2Icon className="size-4" />
        Delete booking
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this booking?</DialogTitle>
          <DialogDescription>
            {formatFullDate(date)} · {from}–{to}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          The Slack post announcing it will be deleted too, so no one's left with a notification for
          something that isn't happening. This can't be undone.
        </p>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteBooking.isPending}
            onClick={() =>
              deleteBooking.mutate({ activityId, bookingId }, { onSuccess: onDeleted })
            }
          >
            {deleteBooking.isPending ? "Deleting…" : "Delete booking"}
          </Button>
        </DialogFooter>

        {deleteBooking.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            Failed to delete booking.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
