import { type FormEvent, type ReactElement, useState } from "react";

import { useCreateBookingMutation, useUpdateBookingMutation } from "../queries/bookings.ts";
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

type EditableBooking = {
  id: string;
  date: string;
  from: string;
  to: string;
  attendeeUserIds: string[];
};

type Props = {
  activityId: string;
  /** YYYY-MM-DD. Fixed date for a new booking — ignored (and editable
   * instead) when `booking` is set. */
  date?: string;
  trigger: ReactElement;
  /** When set, the dialog edits this existing booking instead of creating a
   * new one. */
  booking?: EditableBooking;
};

export const AddBookingDialog = ({ activityId, date, trigger, booking }: Props) => {
  const isEdit = booking !== undefined;

  const [open, setOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState(booking?.date ?? date ?? "");
  const [from, setFrom] = useState(booking?.from ?? "");
  const [to, setTo] = useState(booking?.to ?? "");
  const [attendeeUserIds, setAttendeeUserIds] = useState<string[]>(booking?.attendeeUserIds ?? []);

  const members = useChannelMembersQuery();
  const createBooking = useCreateBookingMutation();
  const updateBooking = useUpdateBookingMutation();
  const mutation = isEdit ? updateBooking : createBooking;

  const resetToInitial = () => {
    setBookingDate(booking?.date ?? date ?? "");
    setFrom(booking?.from ?? "");
    setTo(booking?.to ?? "");
    setAttendeeUserIds(booking?.attendeeUserIds ?? []);
  };

  const toggleAttendee = (userId: string, checked: boolean) => {
    setAttendeeUserIds((ids) => (checked ? [...ids, userId] : ids.filter((id) => id !== userId)));
  };

  const valid = bookingDate !== "" && from !== "" && to !== "" && from < to;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valid) return;

    if (isEdit) {
      updateBooking.mutate(
        { activityId, bookingId: booking.id, date: bookingDate, from, to, attendeeUserIds },
        { onSuccess: () => setOpen(false) },
      );
    } else {
      createBooking.mutate(
        { activityId, date: bookingDate, from, to, attendeeUserIds },
        {
          onSuccess: () => {
            resetToInitial();
            setOpen(false);
          },
        },
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetToInitial();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit booking" : "Add booking"}</DialogTitle>
          <DialogDescription>{formatDateLabel(bookingDate)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="booking-date">Date</Label>
              <Input
                id="booking-date"
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                required
              />
            </div>
          )}

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
            <Button type="submit" disabled={!valid || mutation.isPending}>
              {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add booking"}
            </Button>
          </DialogFooter>

          {mutation.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              {isEdit ? "Failed to save changes." : "Failed to add booking."}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
