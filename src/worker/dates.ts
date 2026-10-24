import { DISPLAY_TIME_ZONE } from "./constants.ts";

/** Today as a plain `YYYY-MM-DD` in the workspace's zone. A booking's `date`
 * is a floating local date and Workers run in UTC, so `new Date()` on its own
 * would move the "is this in the past?" cutoff by the offset. */
export const todayInDisplayZone = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** A booking on a date that has already passed: a record of something that
 * happened rather than an invitation to something coming up. Dates are
 * zero-padded `YYYY-MM-DD`, so comparing them as strings orders them.
 *
 * Today itself is never historical — an event earlier today is still worth
 * announcing, and the booking's own `from`/`to` aren't consulted here. */
export const isHistoricalDate = (date: string) => date < todayInDisplayZone();
