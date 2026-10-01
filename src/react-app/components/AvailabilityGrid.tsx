import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ActivitySlot } from "../../worker/db/schema.ts";
import { bookingOverlayPercent, bookingsForDay } from "../lib/booking-slots.ts";
import type { Responder } from "../lib/responders.ts";
import { slotKey } from "../lib/responders.ts";
import {
  bookedSlotOverlayClass,
  bookingOverlayClass,
  mineWithOthersClass,
  othersSlotClass,
} from "../lib/slot-color.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";
import { BookingInfoPopover } from "./BookingInfoPopover.tsx";
import { Button } from "./ui/button.tsx";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 08:00–23:00, each cell covers one hour
const WINDOW_DAYS = 7;
const DAY_COLUMN_MIN_PX = 72; // 4.5rem — must fit a nowrap date label without overlapping neighbors
const HOUR_CELL_PX = 24; // h-6

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, n: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
};

const startOfDay = (d: Date) => {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
};

const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

const formatDayLabel = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

/** Native tooltip naming who picked a cell — the full picture lives in the
 * breakdown below the grid, this is just the hover answer. */
const namesTitle = (responders: Responder[]) =>
  responders.length > 0 ? responders.map((responder) => responder.name).join(", ") : undefined;

type Props = {
  activityId: string;
  granularity: "day" | "hourly";
  /** Fixed set of candidate dates proposed by the creator; when set, the grid
   * only shows these dates instead of a scrollable rolling window. */
  suggestedDates: string[] | null;
  value: ActivitySlot[];
  onChange: (slots: ActivitySlot[]) => void;
  readOnly?: boolean;
  /** Other users who picked each slot, keyed by `slotKey` — the viewer's own
   * row is excluded by the caller, since their pick shows as the cell fill. */
  responders?: Record<string, Responder[]>;
  /** Whether each slot has an actual booking, keyed the same way. */
  bookedSlots?: Record<string, boolean>;
  bookings?: ActivityWithAvailability["bookings"];
  /** Advisory headcount, shown alongside a booking's attendee count. */
  idealMemberCount?: number | null;
};

export const AvailabilityGrid = ({
  activityId,
  granularity,
  suggestedDates,
  value,
  onChange,
  readOnly = false,
  responders = {},
  bookedSlots = {},
  bookings = [],
  idealMemberCount,
}: Props) => {
  const today = startOfDay(new Date());

  const fixedDays =
    suggestedDates && suggestedDates.length > 0
      ? [...suggestedDates].sort().map((d) => new Date(`${d}T00:00:00`))
      : null;

  const [windowStart, setWindowStart] = useState(today);

  const days = fixedDays ?? Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(windowStart, i));

  const canGoPrev = !fixedDays && windowStart > today;
  const canGoNext = !fixedDays;

  const isDaySelected = (dateStr: string) => value.some((s) => s.date === dateStr);

  const toggleDay = (dateStr: string) => {
    if (isDaySelected(dateStr)) {
      onChange(value.filter((s) => s.date !== dateStr));
    } else {
      onChange([...value, { date: dateStr }]);
    }
  };

  const hourSetForDate = (dateStr: string) => {
    const set = new Set<number>();
    for (const slot of value) {
      if (slot.date !== dateStr || !slot.from || !slot.to) continue;
      const fromHour = Number(slot.from.slice(0, 2));
      const toHour = Number(slot.to.slice(0, 2));
      for (let h = fromHour; h < toHour; h++) set.add(h);
    }
    return set;
  };

  const setHour = (dateStr: string, hour: number, selected: boolean) => {
    const set = hourSetForDate(dateStr);
    if (selected) set.add(hour);
    else set.delete(hour);

    const sorted = [...set].sort((a, b) => a - b);
    const ranges: ActivitySlot[] = [];
    let rangeStart: number | null = null;
    let prev: number | null = null;

    for (const h of sorted) {
      if (rangeStart === null) rangeStart = h;
      else if (prev !== null && h !== prev + 1) {
        ranges.push({ date: dateStr, from: formatHour(rangeStart), to: formatHour(prev + 1) });
        rangeStart = h;
      }
      prev = h;
    }
    if (rangeStart !== null && prev !== null) {
      ranges.push({ date: dateStr, from: formatHour(rangeStart), to: formatHour(prev + 1) });
    }

    onChange([...value.filter((s) => s.date !== dateStr), ...ranges]);
  };

  const dragValueRef = useRef<boolean | null>(null);

  useEffect(() => {
    const clearDrag = () => (dragValueRef.current = null);
    window.addEventListener("pointerup", clearDrag);
    return () => window.removeEventListener("pointerup", clearDrag);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {!fixedDays && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoPrev}
            onClick={() => setWindowStart((w) => addDays(w, -WINDOW_DAYS))}
          >
            Previous week
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoNext}
            onClick={() => setWindowStart((w) => addDays(w, WINDOW_DAYS))}
          >
            Next week
          </Button>
        </div>
      )}

      {granularity === "day" ? (
        <div className="flex flex-wrap gap-2">
          {days.map((d) => {
            const dateStr = toDateStr(d);
            const selected = isDaySelected(dateStr);
            const dayResponders = responders[slotKey(dateStr)] ?? [];
            const others = dayResponders.length;
            const booked = bookedSlots[dateStr] ?? false;
            return (
              <div key={dateStr} className="group relative hover:z-10">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => toggleDay(dateStr)}
                  title={namesTitle(dayResponders)}
                  className={cn(
                    "flex flex-col items-center rounded-md border border-input px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    selected
                      ? cn(
                          "border-primary bg-primary text-primary-foreground",
                          mineWithOthersClass(others),
                        )
                      : others > 0
                        ? othersSlotClass(others)
                        : "hover:bg-muted",
                  )}
                >
                  {formatDayLabel(d)}
                  {booked && <div className={bookedSlotOverlayClass} />}
                </button>
                {others > 0 && (
                  <span
                    title={namesTitle(dayResponders)}
                    className="absolute -top-1.5 -left-1.5 flex size-4 items-center justify-center rounded-full bg-emerald-900 text-[9px] font-medium text-primary-foreground"
                  >
                    {others}
                  </span>
                )}
                {booked && (
                  <BookingInfoPopover
                    activityId={activityId}
                    bookings={bookingsForDay(bookings, dateStr)}
                    idealMemberCount={idealMemberCount}
                    from="activity"
                    className="absolute -bottom-2 -left-2"
                  />
                )}
                <Link
                  to="/activities/$activityId/book"
                  params={{ activityId }}
                  search={{ date: dateStr, from: "activity" }}
                  aria-label={`Add booking for ${formatDayLabel(d)}`}
                  className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-background text-muted-foreground opacity-0 shadow transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  <PlusIcon className="size-4" />
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="-m-3 grid select-none overflow-x-auto p-3"
          style={{
            gridTemplateColumns: `auto repeat(${days.length}, minmax(${DAY_COLUMN_MIN_PX}px, 1fr))`,
          }}
        >
          <div />
          {days.map((d) => {
            const dateStr = toDateStr(d);
            return (
              <Link
                key={dateStr}
                to="/activities/$activityId/book"
                params={{ activityId }}
                search={{ date: dateStr, from: "activity" }}
                aria-label={`Add booking for ${formatDayLabel(d)}`}
                className="group relative grid w-full place-items-center px-1 pb-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="col-start-1 row-start-1 whitespace-nowrap transition-opacity group-hover:opacity-0">
                  {formatDayLabel(d)}
                </span>
                <span className="col-start-1 row-start-1 flex items-center gap-1 whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100">
                  <PlusIcon className="size-4" />
                  Book
                </span>
              </Link>
            );
          })}

          <div className="flex flex-col">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="flex h-6 items-center justify-end pr-2 text-xs text-muted-foreground"
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const dateStr = toDateStr(d);
            return (
              <div
                key={dateStr}
                className="relative flex flex-col"
                style={{ height: HOURS.length * HOUR_CELL_PX }}
              >
                {HOURS.map((hour) => {
                  const selected = hourSetForDate(dateStr).has(hour);
                  const hourResponders = responders[slotKey(dateStr, hour)] ?? [];
                  const others = hourResponders.length;
                  return (
                    <div
                      key={hour}
                      title={namesTitle(hourResponders)}
                      onPointerDown={() => {
                        if (readOnly) return;
                        const next = !selected;
                        dragValueRef.current = next;
                        setHour(dateStr, hour, next);
                      }}
                      onPointerEnter={() => {
                        if (readOnly || dragValueRef.current === null) return;
                        setHour(dateStr, hour, dragValueRef.current);
                      }}
                      className={cn(
                        "flex h-6 items-center justify-center border border-border/50",
                        readOnly ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                        selected
                          ? cn("bg-primary", mineWithOthersClass(others))
                          : others > 0 && othersSlotClass(others),
                      )}
                    >
                      {others > 0 && (
                        <span className="text-[9px] font-medium text-primary-foreground">
                          {others}
                        </span>
                      )}
                    </div>
                  );
                })}

                {bookingsForDay(bookings, dateStr).map((booking) => (
                  <div
                    key={booking.id}
                    className={bookingOverlayClass}
                    style={bookingOverlayPercent(booking, HOURS)}
                  >
                    <BookingInfoPopover
                      activityId={activityId}
                      bookings={[booking]}
                      idealMemberCount={idealMemberCount}
                      from="activity"
                      className="absolute -top-2 -left-2"
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
