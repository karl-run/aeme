import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ActivitySlot } from "../../worker/db/schema.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";
import { useUpsertAvailabilityMutation } from "../queries/availability.ts";
import { Button } from "./ui/button.tsx";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 08:00–23:00, each cell covers one hour
const MIN_VISIBLE_DAYS = 7;
const LABEL_COLUMN_PX = 64; // 4rem
const DAY_COLUMN_MAX_PX = 80; // 5rem
const SAVE_DEBOUNCE_MS = 600;

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

const hourSetForDate = (slots: ActivitySlot[], dateStr: string) => {
  const set = new Set<number>();
  for (const slot of slots) {
    if (slot.date !== dateStr || !slot.from || !slot.to) continue;
    const fromHour = Number(slot.from.slice(0, 2));
    const toHour = Number(slot.to.slice(0, 2));
    for (let h = fromHour; h < toHour; h++) set.add(h);
  }
  return set;
};

const collapseHours = (dateStr: string, hours: Set<number>): ActivitySlot[] => {
  const sorted = [...hours].sort((a, b) => a - b);
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
  return ranges;
};

type RowProps = {
  activity: ActivityWithAvailability;
  days: Date[];
};

/** Renders as `display: contents` so its cells land directly in the parent
 * board's grid, keeping day/hour columns aligned across every activity. */
const PersistentActivityRows = ({ activity, days }: RowProps) => {
  const [slots, setSlots] = useState<ActivitySlot[]>(activity.slots);
  const upsertAvailability = useUpsertAvailabilityMutation();

  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!dirtyRef.current) setSlots(activity.slots);
  }, [activity.slots]);

  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const scheduleSave = (next: ActivitySlot[]) => {
    setSlots(next);
    dirtyRef.current = true;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      upsertAvailability.mutate(
        { activityId: activity.id, slots: next },
        { onSettled: () => (dirtyRef.current = false) },
      );
    }, SAVE_DEBOUNCE_MS);
  };

  const dragValueRef = useRef<boolean | null>(null);

  useEffect(() => {
    const clearDrag = () => (dragValueRef.current = null);
    window.addEventListener("pointerup", clearDrag);
    return () => window.removeEventListener("pointerup", clearDrag);
  }, []);

  const isDaySelected = (dateStr: string) => slots.some((s) => s.date === dateStr);

  const toggleDay = (dateStr: string) => {
    if (isDaySelected(dateStr)) scheduleSave(slots.filter((s) => s.date !== dateStr));
    else scheduleSave([...slots, { date: dateStr }]);
  };

  const setHour = (dateStr: string, hour: number, selected: boolean) => {
    const set = hourSetForDate(slots, dateStr);
    if (selected) set.add(hour);
    else set.delete(hour);
    scheduleSave([...slots.filter((s) => s.date !== dateStr), ...collapseHours(dateStr, set)]);
  };

  const status = upsertAvailability.isPending
    ? "Saving…"
    : upsertAvailability.isError
      ? "Failed to save"
      : null;

  if (activity.slotGranularity === "day") {
    return (
      <div className="contents">
        <div className="col-span-full flex items-center gap-2 border-t border-border pt-3 pb-1">
          <span className="font-medium">{activity.title}</span>
          {status && <span className="text-xs text-muted-foreground">{status}</span>}
        </div>
        <div />
        {days.map((d) => {
          const dateStr = toDateStr(d);
          const selected = isDaySelected(dateStr);
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => toggleDay(dateStr)}
              className={cn(
                "flex h-8 items-center justify-center transition-colors",
                selected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {selected && <CheckIcon className="size-4" />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="contents">
      <div className="col-span-full flex items-center gap-2 border-t border-border pt-3 pb-1">
        <span className="font-medium">{activity.title}</span>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>

      {HOURS.map((hour) => (
        <div key={hour} className="contents">
          <div className="pr-2 text-right text-xs text-muted-foreground">{formatHour(hour)}</div>
          {days.map((d) => {
            const dateStr = toDateStr(d);
            const selected = hourSetForDate(slots, dateStr).has(hour);
            return (
              <div
                key={dateStr + hour}
                onPointerDown={() => {
                  const next = !selected;
                  dragValueRef.current = next;
                  setHour(dateStr, hour, next);
                }}
                onPointerEnter={() => {
                  if (dragValueRef.current !== null) setHour(dateStr, hour, dragValueRef.current);
                }}
                className={cn(
                  "h-6 cursor-pointer border border-border/50",
                  selected ? "bg-primary" : "hover:bg-muted",
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

type Props = {
  activities: ActivityWithAvailability[];
};

export const OngoingBoard = ({ activities }: Props) => {
  const today = startOfDay(new Date());
  const [windowStart, setWindowStart] = useState(today);
  const [visibleDays, setVisibleDays] = useState(MIN_VISIBLE_DAYS);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const recompute = () => {
      const fit = Math.floor((el.clientWidth - LABEL_COLUMN_PX) / DAY_COLUMN_MAX_PX);
      setVisibleDays(Math.max(MIN_VISIBLE_DAYS, fit));
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const days = Array.from({ length: visibleDays }, (_, i) => addDays(windowStart, i));

  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No recurring activities yet.</p>;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={windowStart <= today}
          onClick={() => setWindowStart((w) => addDays(w, -visibleDays))}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setWindowStart((w) => addDays(w, visibleDays))}
        >
          Next
        </Button>
      </div>

      <div
        ref={containerRef}
        className="grid w-full select-none overflow-x-auto"
        style={{
          gridTemplateColumns: `${LABEL_COLUMN_PX}px repeat(${days.length}, minmax(3rem, ${DAY_COLUMN_MAX_PX}px))`,
        }}
      >
        <div />
        {days.map((d) => (
          <div
            key={toDateStr(d)}
            className="px-1 pb-2 text-center text-xs font-medium text-muted-foreground"
          >
            {formatDayLabel(d)}
          </div>
        ))}

        {activities.map((activity) => (
          <PersistentActivityRows key={activity.id} activity={activity} days={days} />
        ))}
      </div>
    </div>
  );
};
