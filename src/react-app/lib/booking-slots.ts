import type { ActivityWithAvailability } from "../queries/activities.ts";

type BookingSummary = ActivityWithAvailability["bookings"][number];

export const bookingsForDay = (bookings: BookingSummary[], date: string) =>
  bookings.filter((booking) => booking.date === date);

const timeToMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Top/height (as CSS percentages of the whole hourly strip) for rendering a
 * booking as one continuous, proportionally-sized overlay against an hour
 * range — as opposed to snapping to whole-hour cell boundaries, which makes
 * a 30-minute booking look identical in size to a 2-hour one. `hours` is the
 * visible hour range (e.g. 8..23), each hour assumed to render as one equal
 * height cell. */
export const bookingOverlayPercent = (booking: { from: string; to: string }, hours: number[]) => {
  const rangeStart = hours[0] * 60;
  const rangeEnd = (hours[hours.length - 1] + 1) * 60;
  const totalMinutes = rangeEnd - rangeStart;

  const from = Math.max(rangeStart, Math.min(rangeEnd, timeToMinutes(booking.from)));
  const to = Math.max(rangeStart, Math.min(rangeEnd, timeToMinutes(booking.to)));

  return {
    top: `${((from - rangeStart) / totalMinutes) * 100}%`,
    height: `${(Math.max(0, to - from) / totalMinutes) * 100}%`,
  };
};
