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
  bookings: BookingSummary[];
};

/** Horizontal list of upcoming bookings anchored to the right side of an
 * activity's header — soonest booking sits leftmost (closest to the title),
 * later ones extend rightward and scroll out of view once there's no more
 * room, so any number of bookings is supported without breaking the layout.
 * Clicking one opens its full details in a modal. */
export const UpcomingBookings = ({ bookings }: Props) => {
  const today = toDateStr(new Date());

  const upcoming = bookings
    .filter((booking) => booking.date >= today)
    .sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from));

  if (upcoming.length === 0) return null;

  return (
    <div className="flex min-w-0 shrink items-center justify-end gap-1.5 overflow-x-auto">
      {upcoming.map((booking) => (
        <BookingDetailsDialog
          key={booking.id}
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
