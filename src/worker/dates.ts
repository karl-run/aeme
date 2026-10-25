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

/** How far the workspace's zone is ahead of UTC at a given instant, in
 * milliseconds — `+02:00` through the summer, `+01:00` after the October
 * switch. Derived by formatting the instant in the zone and reading the
 * wall clock back as though it were UTC: the gap between the two is the
 * offset. `hour` comes back as "24" at midnight in some ICU builds, hence
 * the modulo. */
const zoneOffsetMsAt = (instant: Date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: DISPLAY_TIME_ZONE,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );

  const wallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );

  return wallClock - instant.getTime();
};

/** The instant a booking's stored wall clock actually names — `2026-10-28`
 * at `18:00` in Oslo is `2026-10-28T17:00:00Z`, and the same wall clock in
 * July is `16:00:00Z`.
 *
 * A booking stores the date and time someone typed, with no zone attached,
 * which is all the app itself ever needs: everything that reads it is
 * already thinking in Oslo. A calendar file is the one place that isn't
 * enough — see the note on `toIcsDateTime`.
 *
 * Guessed and then corrected, because the offset to apply depends on the
 * instant and the instant depends on the offset. The first pass uses the
 * offset at the wall clock read as UTC, which lands within an hour or two of
 * the truth; the second uses the offset actually in force there, which is
 * the right one except inside a DST transition itself. A wall clock that
 * daylight saving skipped (02:30 on the March Sunday) has no instant to
 * name and resolves to the hour after the jump; one it repeated resolves to
 * the first pass through. Nobody books padel at half two in the morning. */
export const utcInstantFromDisplayZone = (date: string, time: string): Date => {
  const asIfUtc = Date.parse(`${date}T${time}:00Z`);
  const guess = asIfUtc - zoneOffsetMsAt(new Date(asIfUtc));
  return new Date(asIfUtc - zoneOffsetMsAt(new Date(guess)));
};
