import type { ActivityWithAvailability } from "../queries/activities.ts";

type BookingSummary = ActivityWithAvailability["bookings"][number];

export const bookingsForDay = (bookings: BookingSummary[], date: string) =>
  bookings.filter((booking) => booking.date === date);

export const bookingsForHour = (bookings: BookingSummary[], date: string, hour: number) =>
  bookings.filter(
    (booking) =>
      booking.date === date &&
      Number(booking.from.slice(0, 2)) <= hour &&
      Number(booking.to.slice(0, 2)) > hour,
  );
