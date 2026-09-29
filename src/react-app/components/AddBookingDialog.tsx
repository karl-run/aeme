import { type FormEvent, type ReactElement, useState } from "react";

import { useCreateBookingMutation } from "../queries/bookings.ts";
import { useChannelMembersQuery } from "../queries/channelMembers.ts";
import { Button } from "./ui/button.tsx";
import { Checkbox } from "./ui/checkbox.tsx";
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
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";

const formatDateLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

type Props = {
  activityId: string;
  /** YYYY-MM-DD */
  date: string;
  trigger: ReactElement;
};

export const AddBookingDialog = ({ activityId, date, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [attendeeUserIds, setAttendeeUserIds] = useState<string[]>([]);

  const members = useChannelMembersQuery();
  const createBooking = useCreateBookingMutation();

  const reset = () => {
    setFrom("");
    setTo("");
    setAttendeeUserIds([]);
  };

  const toggleAttendee = (userId: string, checked: boolean) => {
    setAttendeeUserIds((ids) => (checked ? [...ids, userId] : ids.filter((id) => id !== userId)));
  };

  const valid = from !== "" && to !== "" && from < to;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valid) return;

    createBooking.mutate(
      { activityId, date, from, to, attendeeUserIds },
      {
        onSuccess: () => {
          reset();
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add booking</DialogTitle>
          <DialogDescription>{formatDateLabel(date)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="booking-from">Start</Label>
              <Input
                id="booking-from"
                type="time"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="booking-to">End</Label>
              <Input
                id="booking-to"
                type="time"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Who's joining?</Label>
            {members.isPending ? (
              <p className="text-sm text-muted-foreground">Loading members…</p>
            ) : members.data && members.data.length > 0 ? (
              <div className="flex flex-col gap-2">
                {members.data.map((member) => (
                  <div key={member.userId} className="flex items-center gap-2">
                    <Checkbox
                      id={`booking-attendee-${member.userId}`}
                      checked={attendeeUserIds.includes(member.userId)}
                      onCheckedChange={(checked) => toggleAttendee(member.userId, checked === true)}
                    />
                    <Label htmlFor={`booking-attendee-${member.userId}`}>{member.name}</Label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No other members yet.</p>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!valid || createBooking.isPending}>
              {createBooking.isPending ? "Adding…" : "Add booking"}
            </Button>
          </DialogFooter>

          {createBooking.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              Failed to add booking.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
