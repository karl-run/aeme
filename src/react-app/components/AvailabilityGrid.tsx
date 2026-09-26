import { cn } from "cn";
import { useEffect, useRef, useState } from "react";

import type { ActivitySlot } from "../../worker/db/schema.ts";
import { Button } from "./ui/button.tsx";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 08:00–23:00, each cell covers one hour
const WINDOW_DAYS = 7;

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

type Props = {
  granularity: "day" | "hourly";
  /** Fixed set of candidate dates proposed by the creator; when set, the grid
   * only shows these dates instead of a scrollable rolling window. */
  suggestedDates: string[] | null;
  value: ActivitySlot[];
  onChange: (slots: ActivitySlot[]) => void;
  readOnly?: boolean;
};

export const AvailabilityGrid = ({
  granularity,
  suggestedDates,
  value,
  onChange,
  readOnly = false,
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
            return (
              <button
                key={dateStr}
                type="button"
                disabled={readOnly}
                onClick={() => toggleDay(dateStr)}
                className={cn(
                  "flex flex-col items-center rounded-md border border-input px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {formatDayLabel(d)}
              </button>
            );
          })}
        </div>
      ) : (
        <div
          className="grid select-none overflow-x-auto"
          style={{ gridTemplateColumns: `auto repeat(${days.length}, minmax(3rem, 1fr))` }}
        >
          <div />
          {days.map((d) => (
            <div key={toDateStr(d)} className="px-1 pb-1 text-center text-xs text-muted-foreground">
              {formatDayLabel(d)}
            </div>
          ))}

          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="pr-2 text-right text-xs text-muted-foreground">
                {formatHour(hour)}
              </div>
              {days.map((d) => {
                const dateStr = toDateStr(d);
                const selected = hourSetForDate(dateStr).has(hour);
                return (
                  <div
                    key={dateStr + hour}
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
                      "h-6 border border-border/50",
                      readOnly ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted",
                      selected && "bg-primary",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
