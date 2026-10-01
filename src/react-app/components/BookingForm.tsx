import { format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";

import { availableForBooking, offersOnDate } from "../lib/responders.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";
import { useCreateBookingMutation, useUpdateBookingMutation } from "../queries/bookings.ts";
import { useChannelMembersQuery } from "../queries/channelMembers.ts";
import { BookingAvailabilityStrip } from "./BookingAvailabilityStrip.tsx";
import { Button } from "./ui/button.tsx";
import { Calendar } from "./ui/calendar.tsx";
import { Checkbox } from "./ui/checkbox.tsx";
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

export type EditableBooking = {
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
  activity: ActivityWithAvailability;
  /** When set, the form edits this existing booking instead of creating a
   * new one. */
  booking?: EditableBooking;
  /** YYYY-MM-DD pre-filled into the date field (still editable). Ignored
   * when `booking` is set. */
  initialDate?: string;
  /** Called once the booking has been saved — the host route navigates away. */
  onDone: () => void;
  onCancel: () => void;
};

export const BookingForm = ({ activity, booking, initialDate, onDone, onCancel }: Props) => {
  const isEdit = booking !== undefined;

  const [dateOpen, setDateOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState(booking?.date ?? initialDate ?? "");
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

  // Who said they could make this exact slot. An empty time field means we
  // can't narrow it yet, so fall back to the whole day.
  const availableIds = new Set(
    bookingDate === ""
      ? []
      : availableForBooking(
          activity.responses,
          bookingDate,
          from === "" ? "00:00" : from,
          to === "" ? "24:00" : to,
        ).map((responder) => responder.userId),
  );
  const declinedIds = new Set(
    activity.responses.filter((response) => response.declined).map((response) => response.userId),
  );

  // What each person actually offered that day, regardless of the window
  // currently in the form — so someone free 17:00–20:00 reads as that, and
  // not merely as "not free" against an 20:00–22:00 window.
  const rangesByUserId = new Map(
    offersOnDate(activity.responses, bookingDate).map((offer) => [offer.userId, offer.ranges]),
  );
  const hourly = activity.slotGranularity === "hourly";

  // Available first: the whole point of booking from here is to invite the
  // people who already said the slot works for them.
  const sortedMembers = [...(members.data ?? [])].sort((a, b) => {
    const rank = (userId: string) =>
      availableIds.has(userId) ? 0 : declinedIds.has(userId) ? 2 : 1;
    return rank(a.userId) - rank(b.userId);
  });

  const unselectedAvailable = sortedMembers.filter(
    (member) => availableIds.has(member.userId) && !attendeeUserIds.includes(member.userId),
  );

  const toggleAttendee = (userId: string, checked: boolean) => {
    setAttendeeUserIds((ids) => (checked ? [...ids, userId] : ids.filter((id) => id !== userId)));
  };

  const addAllAvailable = () => {
    setAttendeeUserIds((ids) => [...ids, ...unselectedAvailable.map((member) => member.userId)]);
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

    const fields = {
      activityId: activity.id,
      date: bookingDate,
      from,
      to,
      description,
      location,
      attendeeUserIds,
      guestNames,
    };

    if (isEdit) {
      updateBooking.mutate({ ...fields, bookingId: booking.id }, { onSuccess: onDone });
    } else {
      createBooking.mutate(fields, { onSuccess: onDone });
    }
  };

  return (
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

      {hourly && bookingDate !== "" && (
        <div className="flex flex-col gap-1.5">
          <Label>Who's free when</Label>
          <BookingAvailabilityStrip
            responses={activity.responses}
            bookings={activity.bookings}
            date={bookingDate}
            from={from}
            to={to}
            onSelectRange={(nextFrom, nextTo) => {
              setFrom(nextFrom);
              setTo(nextTo);
            }}
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

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Who's joining?</Label>
          {unselectedAvailable.length > 0 && (
            <Button type="button" variant="outline" size="xs" onClick={addAllAvailable}>
              Add everyone free then ({unselectedAvailable.length})
            </Button>
          )}
        </div>
        {bookingDate !== "" && availableIds.size === 0 && (
          <p className="text-xs text-muted-foreground">No one has said this slot works for them.</p>
        )}
        {members.isPending ? (
          <p className="text-sm text-muted-foreground">Loading members…</p>
        ) : sortedMembers.length > 0 ? (
          <div className="flex flex-col gap-2">
            {sortedMembers.map((member) => (
              <div key={member.userId} className="flex items-center gap-2">
                <Checkbox
                  id={`booking-attendee-${member.userId}`}
                  checked={attendeeUserIds.includes(member.userId)}
                  onCheckedChange={(checked) => toggleAttendee(member.userId, checked === true)}
                />
                <Label htmlFor={`booking-attendee-${member.userId}`}>{member.name}</Label>
                {availableIds.has(member.userId) ? (
                  <span className="rounded-full bg-emerald-800 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {hourly && (rangesByUserId.get(member.userId)?.length ?? 0) > 0
                      ? rangesByUserId.get(member.userId)?.join(", ")
                      : "free then"}
                  </span>
                ) : rangesByUserId.has(member.userId) ? (
                  // Free that day, just not during the window in the form —
                  // worth seeing, since nudging the time by an hour may be
                  // all it takes to include them.
                  <span
                    className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    title="Available that day, but not during this time"
                  >
                    {rangesByUserId.get(member.userId)?.join(", ") || "free that day"}
                  </span>
                ) : declinedIds.has(member.userId) ? (
                  <span className="text-[10px] text-destructive">can't make it</span>
                ) : null}
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

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || mutation.isPending}>
          {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Add booking"}
        </Button>
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive" aria-live="polite">
          {isEdit ? "Failed to save changes." : "Failed to add booking."}
        </p>
      )}
    </form>
  );
};
