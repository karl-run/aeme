import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { client } from "../api.ts";

export const calendarMonthQueryKey = (month: string) => ["calendar", month] as const;

/** Every booking in the channel on the days a month's grid shows — the month
 * itself plus the overflow days filling its first and last week.
 *
 * One request per month, cached under the month alone: `range` is derived
 * from `month`, so it would only ever be the same two dates again. Browsing
 * back through the year is a request per month visited rather than one
 * payload of everything ever booked.
 *
 * `keepPreviousData` holds the month you were reading on screen while the
 * next one loads, so stepping through months slides rather than blanking. */
export const useCalendarMonthQuery = (
  month: string,
  range: { from: string; to: string },
  enabled: boolean,
) =>
  useQuery({
    queryKey: calendarMonthQueryKey(month),
    queryFn: async () => {
      const res = await client.calendar.$get({ query: range });
      if (!res.ok) throw new Error("Failed to load the calendar.");
      const { bookings } = await res.json();
      return bookings;
    },
    placeholderData: keepPreviousData,
    enabled,
  });

export type CalendarBooking = NonNullable<ReturnType<typeof useCalendarMonthQuery>["data"]>[number];
