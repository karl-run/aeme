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
const CARD_INSET_PX = 34; // card padding + border, subtracted when fitting day columns
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

type CardProps = {
  activity: ActivityWithAvailability;
  days: Date[];
};

const ActivityPickerCard = ({ activity, days }: CardProps) => {
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

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{activity.title}</h3>
        {status && <span className="text-xs text-muted-foreground">{status}</span>}
      </div>
      {activity.description && (
        <p className="-mt-2 text-sm text-muted-foreground">{activity.description}</p>
      )}

      <div
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

        {activity.slotGranularity === "day" ? (
          <>
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
                    "group relative flex h-8 items-center justify-center rounded-sm border border-dashed transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted",
                  )}
                >
                  {selected ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <span className="text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      æme!
                    </span>
                  )}
                </button>
              );
            })}
          </>
        ) : (
          HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="pr-2 text-right text-xs text-muted-foreground">
                {formatHour(hour)}
              </div>
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
                      if (dragValueRef.current !== null)
                        setHour(dateStr, hour, dragValueRef.current);
                    }}
                    className={cn(
                      "group relative flex h-6 cursor-pointer items-center justify-center border border-dashed transition-colors",
                      selected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted",
                    )}
                  >
                    {!selected && (
                      <span className="text-[9px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        æme!
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
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
      const fit = Math.floor(
        (el.clientWidth - CARD_INSET_PX - LABEL_COLUMN_PX) / DAY_COLUMN_MAX_PX,
      );
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
    <div ref={containerRef} className="flex w-full flex-col gap-4">
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

      {activities.map((activity) => (
        <ActivityPickerCard key={activity.id} activity={activity} days={days} />
      ))}
    </div>
  );
};
