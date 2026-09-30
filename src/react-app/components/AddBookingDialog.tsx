import { format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type ReactElement, useState } from "react";

import { useCreateBookingMutation, useUpdateBookingMutation } from "../queries/bookings.ts";
import { useChannelMembersQuery } from "../queries/channelMembers.ts";
import { Button } from "./ui/button.tsx";
import { Calendar } from "./ui/calendar.tsx";
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
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";
import { Textarea } from "./ui/textarea.tsx";

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

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
  description: string;
  location: string;
  attendeeUserIds: string[];
  guestNames: string[];
};

type Props = {
  activityId: string;
  /** YYYY-MM-DD. Pre-fills the date field for a new booking (still
   * editable); omit to let the user pick one, e.g. from a standalone "Book"
   * action not tied to a specific day. Ignored when `booking` is set. */
  date?: string;
  trigger: ReactElement;
  /** When set, the dialog edits this existing booking instead of creating a
   * new one. */
  booking?: EditableBooking;
};

export const AddBookingDialog = ({ activityId, date, trigger, booking }: Props) => {
  const isEdit = booking !== undefined;

  const [open, setOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState(booking?.date ?? date ?? "");
  const [from, setFrom] = useState(booking?.from ?? "");
  const [to, setTo] = useState(booking?.to ?? "");
  const [description, setDescription] = useState(booking?.description ?? "");
  const [location, setLocation] = useState(booking?.location ?? "");
  const [attendeeUserIds, setAttendeeUserIds] = useState<string[]>(booking?.attendeeUserIds ?? []);
  const [guestNames, setGuestNames] = useState<string[]>(booking?.guestNames ?? []);
  const [guestNameInput, setGuestNameInput] = useState("");

  const members = useChannelMembersQuery();
  const createBooking = useCreateBookingMutation();
  const updateBooking = useUpdateBookingMutation();
  const mutation = isEdit ? updateBooking : createBooking;

  const resetToInitial = () => {
    setBookingDate(booking?.date ?? date ?? "");
    setFrom(booking?.from ?? "");
    setTo(booking?.to ?? "");
    setDescription(booking?.description ?? "");
    setLocation(booking?.location ?? "");
    setAttendeeUserIds(booking?.attendeeUserIds ?? []);
    setGuestNames(booking?.guestNames ?? []);
    setGuestNameInput("");
  };

  const toggleAttendee = (userId: string, checked: boolean) => {
    setAttendeeUserIds((ids) => (checked ? [...ids, userId] : ids.filter((id) => id !== userId)));
  };

  const addGuestName = () => {
    const name = guestNameInput.trim();
    if (name === "") return;
    setGuestNames((names) => [...names, name]);
    setGuestNameInput("");
  };

  const removeGuestName = (index: number) => {
    setGuestNames((names) => names.filter((_, i) => i !== index));
  };

  const handleGuestNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    addGuestName();
  };

  const valid = bookingDate !== "" && from !== "" && to !== "" && from < to;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valid) return;

    if (isEdit) {
      updateBooking.mutate(
        {
          activityId,
          bookingId: booking.id,
          date: bookingDate,
          from,
          to,
          description,
          location,
          attendeeUserIds,
          guestNames,
        },
        { onSuccess: () => setOpen(false) },
      );
    } else {
      createBooking.mutate(
        {
          activityId,
          date: bookingDate,
          from,
          to,
          description,
          location,
          attendeeUserIds,
          guestNames,
        },
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
          <DialogDescription>
            {bookingDate ? formatDateLabel(bookingDate) : "Pick a date and time."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-date">Date</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger
                render={
                  <Button
                    id="booking-date"
                    type="button"
                    variant="outline"
                    className="justify-start font-normal"
                  />
                }
              >
                <CalendarIcon className="size-4" />
                {bookingDate ? format(new Date(`${bookingDate}T00:00:00`), "PPP") : "Pick a date"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  required
                  selected={bookingDate ? new Date(`${bookingDate}T00:00:00`) : undefined}
                  onSelect={(next) => {
                    setBookingDate(toDateStr(next));
                    setDateOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

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
            <Label htmlFor="booking-description">Description</Label>
            <Textarea
              id="booking-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's happening?"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-location">Location</Label>
            <Input
              id="booking-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Address or Google Maps link"
            />
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
            {guestNames.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {guestNames.map((name, index) => (
                  <span
                    key={`${name}-${index}`}
                    className="flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-xs"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => removeGuestName(index)}
                      aria-label={`Remove ${name}`}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-guest-name">Add someone without Slack</Label>
            <div className="flex gap-2">
              <Input
                id="booking-guest-name"
                value={guestNameInput}
                onChange={(e) => setGuestNameInput(e.target.value)}
                onKeyDown={handleGuestNameKeyDown}
                placeholder="Name"
              />
              <Button type="button" variant="outline" onClick={addGuestName}>
                Add
              </Button>
            </div>
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
