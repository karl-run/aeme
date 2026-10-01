import type { ActivityWithAvailability } from "../queries/activities.ts";

type Booking = ActivityWithAvailability["bookings"][number];

/** Bookings store local wall-clock date/time with no offset (the same
 * "floating" convention the ICS export documents), so they're parsed as local
 * time rather than compared as strings. */
const bookingStart = (booking: Booking) => new Date(`${booking.date}T${booking.from}`);

/** Local YYYY-MM-DD, matching how a booking's `date` is stored. */
const toDateStr = (d: Date) => {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

/** Whether the respond-by deadline has passed.
 *
 * `endTime` is also a local wall-clock datetime with no offset, so it has to
 * be parsed as local time: comparing the raw string against
 * `new Date().toISOString()` measures a local time against a UTC one and
 * keeps a request open for the length of the timezone offset. */
export const isRespondByPassed = (activity: ActivityWithAvailability) =>
  activity.endTime !== null && new Date(activity.endTime) < new Date();

/** Bookings that haven't passed, soonest first.
 *
 * A booking counts as upcoming for the whole of its day rather than until its
 * end time: an event earlier today is still today's plan, and dropping it the
 * moment it ends reads as the app forgetting something that just happened. */
export const upcomingBookings = (bookings: Booking[]) => {
  const today = toDateStr(new Date());
  return bookings
    .filter((booking) => booking.date >= today)
    .sort((a, b) => bookingStart(a).getTime() - bookingStart(b).getTime());
};

/** When the next unfinished booking starts, for ordering by what's soonest.
 * `Infinity` when there's nothing upcoming, so those sort last. */
export const nextBookingTime = (activity: ActivityWithAvailability) => {
  const [next] = upcomingBookings(activity.bookings);
  return next ? bookingStart(next).getTime() : Infinity;
};

/** Where a one-off activity belongs on the dashboard:
 *
 * - `open` — still taking responses.
 * - `locked` — responses closed, but something is booked and still to come.
 *   Done deciding, not done happening, so it stays in plain sight.
 * - `past` — closed with nothing upcoming. Safe to collapse away. */
export type OneOffBucket = "open" | "locked" | "past";

export const oneOffBucket = (activity: ActivityWithAvailability): OneOffBucket => {
  if (!isRespondByPassed(activity)) return "open";
  return upcomingBookings(activity.bookings).length > 0 ? "locked" : "past";
};
