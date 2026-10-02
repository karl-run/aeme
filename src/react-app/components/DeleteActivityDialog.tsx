import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { useDeleteActivityMutation } from "../queries/activities.ts";
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

type Props = {
  activityId: string;
  title: string;
  /** Deleting would take these with it, so it's refused while any exist —
   * surfaced here rather than hidden, so the way out is obvious. */
  bookingCount: number;
  /** Called once it's gone — the host route navigates away. */
  onDeleted: () => void;
};

export const DeleteActivityDialog = ({ activityId, title, bookingCount, onDeleted }: Props) => {
  const [open, setOpen] = useState(false);
  const deleteActivity = useDeleteActivityMutation();

  if (bookingCount > 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {bookingCount === 1
          ? "This has a booking, so it can't be deleted yet — delete the booking first."
          : `This has ${bookingCount} bookings, so it can't be deleted yet — delete those first.`}
      </p>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="destructive" />}>
        <Trash2Icon className="size-4" />
        Delete activity
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this activity?</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Everyone's answers and any fixed locations go with it, and the Slack post announcing it is
          deleted. This can't be undone.
        </p>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteActivity.isPending}
            onClick={() => deleteActivity.mutate({ activityId }, { onSuccess: onDeleted })}
          >
            {deleteActivity.isPending ? "Deleting…" : "Delete activity"}
          </Button>
        </DialogFooter>

        {deleteActivity.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            Failed to delete activity.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
