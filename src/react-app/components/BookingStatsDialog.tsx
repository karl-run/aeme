import { cn } from "cn";
import { ChartColumnIcon } from "lucide-react";
import { lazy, type ReactNode, Suspense, useState } from "react";

import { useBookingStatsQuery } from "../queries/stats.ts";
import { LazyChunkBoundary } from "./LazyChunkBoundary.tsx";
import type { TimeCell } from "./TimeHeatmap.tsx";
import { Button } from "./ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog.tsx";

/** The charts and `@tanstack/charts` behind them are fetched when someone
 * opens the dashboard — the home board and every other page never pay for
 * it. The library itself is shared between the three lazy modules, so the
 * dialog pulls one copy of it however many charts end up on screen.
 *
 * Only the types cross this boundary eagerly, and those are erased. */
const CountBarChart = lazy(() =>
  import("./CountBarChart.tsx").then((m) => ({ default: m.CountBarChart })),
);

const TimeHeatmap = lazy(() =>
  import("./TimeHeatmap.tsx").then((m) => ({ default: m.TimeHeatmap })),
);

const CoAttendanceMatrix = lazy(() =>
  import("./CoAttendanceMatrix.tsx").then((m) => ({ default: m.CoAttendanceMatrix })),
);

/** Fewer people than this and the matrix says nothing the regulars chart
 * doesn't: two make a single cell, three make three. Four is where a grid
 * starts to beat a list. */
const MIN_MATRIX_PEOPLE = 4;

/** ISO-8601 weekday order, 1 = Monday — the same week the heatmap draws,
 * spelled out again here because that module may only be reached lazily. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatHour = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** The weekday/hour that comes up most, for the headline row. Ties go to the
 * earlier slot, so an unchanged history always names the same one. */
const busiestSlot = (cells: readonly TimeCell[]) => {
  const best = cells.reduce<TimeCell | undefined>(
    (max, cell) => (!max || cell.count > max.count ? cell : max),
    undefined,
  );

  if (!best) return undefined;

  return {
    label: `${WEEKDAYS[best.weekday - 1] ?? "?"} ${formatHour(best.hour)}`,
    count: best.count,
  };
};

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

type StatProps = {
  label: string;
  value: string;
  detail?: string;
};

/** One headline number, read before any of the plots below it. Proportional
 * figures rather than tabular: these don't sit in a column, and tabular
 * digits read loose at this size. */
const Stat = ({ label, value, detail }: StatProps) => (
  <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-card p-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="truncate text-2xl leading-tight font-semibold" title={value}>
      {value}
    </span>
    {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
  </div>
);

type PanelProps = {
  title: string;
  hint?: string;
  /** Tailwind column spans — how much of the grid this plot is worth. */
  className?: string;
  children: ReactNode;
};

/** A plot and its heading on a card of their own, so the dashboard reads as
 * tiles rather than as one scrolling column of headings. */
const Panel = ({ title, hint, className, children }: PanelProps) => (
  <section
    className={cn("flex flex-col gap-3 rounded-lg border border-border bg-card p-4", className)}
  >
    <div className="flex flex-col gap-0.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
    {children}
  </section>
);

type Props = {
  activityId: string;
  /** Past bookings, from the polled activity payload — lets the whole thing
   * stay hidden when there's no history to look back on, before anything is
   * fetched. */
  pastBookingCount: number;
};

/** What the finished bookings add up to — who keeps coming, when, and where —
 * as a dashboard behind one button.
 *
 * A dialog rather than a panel on the page: these four plots only make sense
 * read against each other, and side by side they need more width than the
 * activity page's reading column has. Everything in it is deferred twice
 * over: the counts are a set of group-bys over the whole history, so they're
 * left off the polled activities payload and fetched on open, and the chart
 * library is a lazy import. Failures are handled on their own — a failed
 * fetch offers a retry, a failed chunk falls back to a message — because
 * neither should take the activity page with it. */
export const BookingStatsDialog = ({ activityId, pastBookingCount }: Props) => {
  const [open, setOpen] = useState(false);
  const stats = useBookingStatsQuery(activityId, open);

  if (pastBookingCount === 0) return null;

  const data = stats.data;

  // One place used every time is a fact the list of locations already tells
  // you; a chart of a single full-width bar isn't worth a tile.
  const showLocations = (data?.locations.length ?? 0) > 1;

  // An empty grid is its own kind of answer, but not an interesting one: a
  // group where nobody has ever shared a booking gets no matrix at all.
  const showPairs =
    (data?.attendance.length ?? 0) >= MIN_MATRIX_PEOPLE && (data?.pairs.length ?? 0) > 0;

  const top = data?.attendance[0];
  const spot = data?.locations[0];
  const peak = data ? busiestSlot(data.times) : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <ChartColumnIcon className="size-4" />
            Stats
          </Button>
        }
      />

      {/* Nearly the whole viewport: four plots side by side is the point of
          moving them off the page, and they need the room. */}
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-[1400px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 text-left">
          <DialogTitle>Looking back</DialogTitle>
          <DialogDescription>
            {data
              ? `Who's been joining, when, and where — across ${plural(data.bookings, "past booking")}.`
              : "Who's been joining, when, and where, across the bookings that have already happened."}
          </DialogDescription>
        </DialogHeader>

        {/* `min-h-0`, or the body would grow past the fixed-height popup and be
            clipped by its `overflow-hidden` instead of scrolling. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
          {stats.isError ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-destructive" aria-live="polite">
                Failed to load the stats.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={stats.isFetching}
                onClick={() => stats.refetch()}
              >
                {stats.isFetching ? "Retrying…" : "Try again"}
              </Button>
            </div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading…
            </p>
          ) : data.attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No one's been listed on a past booking yet.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Auto-fit rather than a fixed column count: the row holds
                  three to five tiles depending on what there is to say, and
                  they should fill the width either way. */}
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
                <Stat label="Bookings played" value={String(data.bookings)} />
                <Stat
                  label="People"
                  value={String(data.attendance.length)}
                  detail="Listed on a past booking"
                />
                {top && (
                  <Stat
                    label="Most regular"
                    value={top.name}
                    detail={`${top.count} of ${data.bookings}`}
                  />
                )}
                {peak && (
                  <Stat
                    label="Busiest slot"
                    value={peak.label}
                    detail={plural(peak.count, "booking")}
                  />
                )}
                {spot && (
                  <Stat
                    label="Usual spot"
                    value={spot.name}
                    detail={`${spot.count} of ${data.bookings}`}
                  />
                )}
              </div>

              <LazyChunkBoundary
                fallback={
                  <p className="text-sm text-destructive" aria-live="polite">
                    Couldn't load the charts. Reloading the page usually fixes it.
                  </p>
                }
              >
                <Suspense
                  fallback={
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                      Drawing…
                    </p>
                  }
                >
                  {/* Six columns, so a tile can be worth a half or a third of
                      the row. Below `xl` the dialog isn't wide enough for two
                      plots side by side and they stack. */}
                  <div className="grid gap-4 xl:grid-cols-6">
                    <Panel
                      title="Regulars"
                      hint="Bookings joined, most first"
                      className="xl:col-span-3"
                    >
                      <CountBarChart
                        rows={data.attendance}
                        total={data.bookings}
                        axisLabel={`Bookings joined of ${data.bookings}`}
                        valueLabel="Joined"
                        ariaLabel="Bookings joined per person"
                      />
                    </Panel>

                    {data.times.length > 0 && (
                      <Panel
                        title="Popular times"
                        hint="Weekday across, hour of the day down"
                        className="xl:col-span-3"
                      >
                        <TimeHeatmap cells={data.times} ariaLabel="Bookings by weekday and hour" />
                      </Panel>
                    )}

                    {showPairs && (
                      <Panel
                        title="Who plays with whom"
                        hint="Bookings each pair were both on"
                        className={showLocations ? "xl:col-span-4" : "xl:col-span-6"}
                      >
                        <CoAttendanceMatrix
                          people={data.attendance}
                          pairs={data.pairs}
                          ariaLabel="Bookings shared by each pair of people"
                        />
                      </Panel>
                    )}

                    {showLocations && (
                      <Panel
                        title="Favourite spots"
                        hint="Where it keeps happening"
                        className={showPairs ? "xl:col-span-2" : "xl:col-span-3"}
                      >
                        <CountBarChart
                          rows={data.locations}
                          total={data.bookings}
                          axisLabel={`Bookings played there of ${data.bookings}`}
                          valueLabel="Played there"
                          ariaLabel="Bookings per location"
                        />
                      </Panel>
                    )}
                  </div>
                </Suspense>
              </LazyChunkBoundary>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
