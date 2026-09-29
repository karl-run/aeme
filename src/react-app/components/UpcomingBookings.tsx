import type { ActivityWithAvailability } from "../queries/activities.ts";
import { BookingDetailsDialog } from "./BookingDetailsDialog.tsx";

type BookingSummary = ActivityWithAvailability["bookings"][number];

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatChipDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

type Props = {
  activityId: string;
  bookings: BookingSummary[];
};

/** Horizontal, scrollable list of upcoming bookings — soonest booking is
 * leftmost, later ones scroll into view. Deliberately left-aligned (not
 * `justify-end`): a `justify-content: flex-end`/`center` flex container with
 * `overflow: auto` computes its rest scroll position as already-scrolled,
 * which makes the "earlier" content genuinely unreachable via swipe on many
 * mobile browsers — `justify-start` is the only variant with a normal,
 * universally-reliable scroll range. Clicking one opens its full details in
 * a modal. */
export const UpcomingBookings = ({ activityId, bookings }: Props) => {
  const today = toDateStr(new Date());

  const upcoming = bookings
    .filter((booking) => booking.date >= today)
    .sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from));

  if (upcoming.length === 0) return null;

  return (
    <div className="flex min-w-0 shrink items-center gap-1.5 overflow-x-auto">
      {upcoming.map((booking) => (
        <BookingDetailsDialog
          key={booking.id}
          activityId={activityId}
          booking={booking}
          trigger={
            <button
              type="button"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-green-600/40 bg-green-600/10 py-1 pr-1 pl-2 text-xs whitespace-nowrap text-green-700 transition-colors hover:bg-green-600/20 dark:text-green-400"
            >
              <span>
                {formatChipDate(booking.date)} · {booking.from}
              </span>
              {booking.attendeeNames.length > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-green-600 text-[9px] font-medium text-white">
                  {booking.attendeeNames.length}
                </span>
              )}
            </button>
          }
        />
      ))}
    </div>
  );
};
