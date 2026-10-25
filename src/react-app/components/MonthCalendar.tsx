import { cn } from "cn";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { CalendarBooking } from "../queries/calendar.ts";
import { BookingDetailsDialog } from "./BookingDetailsDialog.tsx";

/** Monday, like the rest of the working week here — `date-fns` defaults to
 * Sunday, and the locale data that would decide it properly is a whole
 * import for one number. */
const WEEK_STARTS_ON = 1;

const toDateStr = (date: Date) => format(date, "yyyy-MM-dd");

/** Every day the month's grid draws: the month itself, plus the days either
 * side of it that fill out its first and last week. */
export const monthGridDays = (month: Date) =>
  eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: WEEK_STARTS_ON }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: WEEK_STARTS_ON }),
  });

/** The same span as dates, which is what the calendar query asks the server
 * for — so the overflow days aren't drawn empty while holding bookings. */
export const monthGridRange = (month: Date) => {
  const days = monthGridDays(month);
  return { from: toDateStr(days[0]), to: toDateStr(days[days.length - 1]) };
};

/** Mon–Sun in the viewer's language, taken off a week that starts on a
 * Monday (1 Jan 2024 was one). */
const WEEKDAY_LABELS = monthGridDays(new Date(2024, 0, 1))
  .slice(0, 7)
  .map((day) => day.toLocaleDateString(undefined, { weekday: "short" }));

const byDate = (bookings: CalendarBooking[]) => {
  const map = new Map<string, CalendarBooking[]>();
  for (const booking of bookings) {
    const list = map.get(booking.date) ?? [];
    list.push(booking);
    map.set(booking.date, list);
  }
  return map;
};

type Props = {
  /** Any day in the month to draw; the grid works from its first. */
  month: Date;
  bookings: CalendarBooking[];
};

/** A month at a time, every activity in the channel on it. Each booking is a
 * chip that opens the same details dialog the dashboard uses.
 *
 * Deliberately not capped at "+2 more" per day: a day with five bookings is
 * rare enough that growing the row beats hiding two of them behind a count
 * that then needs somewhere of its own to expand. */
export const MonthCalendar = ({ month, bookings }: Props) => {
  const days = monthGridDays(month);
  const bookingsByDate = byDate(bookings);
  const today = toDateStr(new Date());

  return (
    <div className="grid w-full grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
      {WEEKDAY_LABELS.map((label) => (
        <div
          key={label}
          className="bg-card px-1 py-1.5 text-center text-xs font-medium text-muted-foreground"
        >
          {label}
        </div>
      ))}

      {days.map((day) => {
        const date = toDateStr(day);
        const inMonth = isSameMonth(day, month);
        const dayBookings = bookingsByDate.get(date) ?? [];

        return (
          <div
            key={date}
            className={cn(
              "flex min-h-24 flex-col gap-1 p-1.5",
              inMonth ? "bg-card" : "bg-muted/30",
            )}
          >
            <span
              className={cn(
                "self-start rounded-full px-1.5 text-xs leading-5 tabular-nums",
                date === today
                  ? "bg-primary font-semibold text-primary-foreground"
                  : inMonth
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50",
              )}
            >
              {day.getDate()}
            </span>

            {dayBookings.map((booking) => {
              // Anything before today is a record of something that
              // happened. It's shown in the muted palette, and its edit link
              // is withheld for the same reason the booking history's is:
              // the edit screen reads the booking out of the dashboard
              // payload, which only carries what's still to come.
              const past = booking.date < today;

              return (
                <BookingDetailsDialog
                  key={booking.id}
                  activityId={booking.activityId}
                  booking={booking}
                  idealMemberCount={booking.idealMemberCount}
                  from="calendar"
                  editable={!past}
                  trigger={
                    <button
                      type="button"
                      title={`${booking.from}–${booking.to} · ${booking.activityTitle}`}
                      aria-label={`${booking.from}–${booking.to} ${booking.activityTitle}`}
                      className={cn(
                        "w-full truncate rounded border px-1 py-0.5 text-left text-[10px] leading-4 transition-colors sm:text-[11px]",
                        past
                          ? "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                          : "border-green-600/30 bg-green-600/10 hover:bg-green-600/20",
                      )}
                    >
                      {/* A phone's column is about five characters wide, so
                          the title drops and the time stays: when it is is
                          the half you can't get from the cell it's in. */}
                      <span className="tabular-nums opacity-70">{booking.from}</span>
                      <span className="hidden sm:inline"> {booking.activityTitle}</span>
                    </button>
                  }
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
