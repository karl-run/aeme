import { upcomingBookings } from "../lib/activity-state.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";
import { BookingDetailsDialog } from "./BookingDetailsDialog.tsx";

type BookingSummary = ActivityWithAvailability["bookings"][number];

const formatChipDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

type Props = {
  activityId: string;
  bookings: BookingSummary[];
  /** Advisory headcount, shown in the badge as "N/ideal" when set. */
  idealMemberCount?: number | null;
};

/** Horizontal, scrollable list of upcoming bookings — soonest booking is
 * leftmost, later ones scroll into view. Deliberately left-aligned (not
 * `justify-end`): a `justify-content: flex-end`/`center` flex container with
 * `overflow: auto` computes its rest scroll position as already-scrolled,
 * which makes the "earlier" content genuinely unreachable via swipe on many
 * mobile browsers — `justify-start` is the only variant with a normal,
 * universally-reliable scroll range. Clicking one opens its full details in
 * a modal. */
export const UpcomingBookings = ({ activityId, bookings, idealMemberCount }: Props) => {
  const upcoming = upcomingBookings(bookings);

  if (upcoming.length === 0) return null;

  return (
    <div className="flex min-w-0 shrink items-center gap-1.5 overflow-x-auto">
      {upcoming.map((booking) => (
        <BookingDetailsDialog
          key={booking.id}
          activityId={activityId}
          booking={booking}
          idealMemberCount={idealMemberCount}
          from="home"
          trigger={
            <button
              type="button"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-green-600/40 bg-green-600/10 py-1 pr-1 pl-2 text-xs whitespace-nowrap text-green-700 transition-colors hover:bg-green-600/20 dark:text-green-400"
            >
              <span>
                {formatChipDate(booking.date)} · {booking.from}
              </span>
              {booking.attendeeNames.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-green-600 px-1 text-[9px] font-medium text-white">
                  {idealMemberCount
                    ? `${booking.attendeeNames.length}/${idealMemberCount}`
                    : booking.attendeeNames.length}
                </span>
              )}
            </button>
          }
        />
      ))}
    </div>
  );
};
