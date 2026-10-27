import { defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { cell } from "@tanstack/charts/rect";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleOrdinal } from "@tanstack/charts/scales/ordinal";
import { tooltip } from "@tanstack/charts/tooltip";

import { bucketOf, EMPTY, rampFor, stepsFor } from "../lib/heat-ramp.ts";
import { HeatLegend } from "./HeatLegend.tsx";

/** Like `CountBarChart.tsx`, this module is only ever reached through the
 * lazy import in `BookingStats.tsx` — see the note there. */

export type TimeCell = {
  /** ISO-8601: 1 = Monday. */
  weekday: number;
  hour: number;
  count: number;
};

/** The same hours the availability grid shows. Bookings outside them are
 * rare enough not to be worth sixteen more rows of empty grid, and the
 * caption says so when there are any. */
const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);

const WEEKDAYS = [
  { weekday: 1, label: "Mon" },
  { weekday: 2, label: "Tue" },
  { weekday: 3, label: "Wed" },
  { weekday: 4, label: "Thu" },
  { weekday: 5, label: "Fri" },
  { weekday: 6, label: "Sat" },
  { weekday: 7, label: "Sun" },
] as const;

const HOUR_ROW_HEIGHT = 20;
/** Room for the weekday labels above the grid. */
const AXIS_HEIGHT = 28;
/** Room for the hour labels down the left. */
const HOUR_GUTTER = 42;

const formatHour = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

type Cell = {
  label: string;
  hourLabel: string;
  weekdayLabel: string;
  hour: number;
  count: number;
  bucket: number;
};

type Props = {
  /** Only the weekday/hour pairs that were played; the blanks are filled in
   * here, since an empty cell is part of the picture. */
  cells: readonly TimeCell[];
  ariaLabel: string;
};

/** When an activity actually happens: weekday across, hour of the day down.
 *
 * A heatmap rather than two bar charts because the two questions people ask
 * ("are we a Tuesday thing?", "do we play late?") have a joint answer — the
 * Tuesday-at-20:00 cell — that neither axis alone can show. */
export const TimeHeatmap = ({ cells, ariaLabel }: Props) => {
  const counts = new Map(cells.map((entry) => [`${entry.weekday}:${entry.hour}`, entry.count]));
  const inWindow = cells.filter((entry) => HOURS.includes(entry.hour));
  const busiest = inWindow.reduce((max, entry) => Math.max(max, entry.count), 0);
  const hasOutside = inWindow.length < cells.length;
  const steps = rampFor(stepsFor(busiest));

  const grid: Cell[] = HOURS.flatMap((hour) =>
    WEEKDAYS.map(({ weekday, label }) => {
      const count = counts.get(`${weekday}:${hour}`) ?? 0;

      return {
        // The band scales key off the label, so each cell needs a key of its
        // own for the tooltip to resolve one datum rather than a column.
        label: `${label} ${formatHour(hour)}`,
        hourLabel: formatHour(hour),
        weekdayLabel: label,
        hour,
        count,
        bucket: bucketOf(count, busiest),
      };
    }),
  );

  const chart = defineChart({
    marks: [
      cell(grid, {
        x: "weekdayLabel",
        y: "hourLabel",
        color: "bucket",
        // A pixel off each edge, so neighbouring cells are separated by the
        // card rather than running into one continuous wash.
        inset: 1,
        radius: 2,
      }),
    ],
    scales: {
      // Weekdays read across the top, the way a week is written down.
      x: { scale: () => scaleBand().padding(0), side: "top" },
      y: { scale: () => scaleBand().padding(0) },
    },
    // An explicit domain, so the ramp is pinned to the bucket number and not
    // to whichever buckets happen to occur — a grid whose busiest cell is a
    // 2 keeps the same two colors it would have in a busier week.
    color: {
      scale: scaleOrdinal,
      domain: [0, ...steps.map((_, index) => index + 1)],
      range: [EMPTY, ...steps],
    },
    margin: { left: HOUR_GUTTER, right: 4, top: AXIS_HEIGHT, bottom: 4 },
    theme: {
      foreground: "#fafafa",
      muted: "#a89ea9",
      grid: "#2a212c",
    },
    tooltip: {
      use: tooltip,
      content: (points) => {
        const datum = points[0]?.datum;
        if (!datum) return { rows: [] };

        return {
          title: datum.label,
          rows: [
            {
              label: "Played",
              value:
                datum.count === 0
                  ? "never"
                  : `${datum.count} booking${datum.count === 1 ? "" : "s"}`,
            },
          ],
        };
      },
    },
  });

  // The busiest handful, so a screen reader gets the headline rather than a
  // hundred and twelve cells of mostly nothing.
  const busiestCells = [...inWindow]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(
      (entry) => `${WEEKDAYS[entry.weekday - 1]?.label} ${formatHour(entry.hour)}: ${entry.count}`,
    )
    .join(", ");

  return (
    <div className="flex flex-col gap-2">
      <Chart
        definition={chart}
        height={HOURS.length * HOUR_ROW_HEIGHT + AXIS_HEIGHT}
        ariaLabel={ariaLabel}
        ariaDescription={
          busiest === 0
            ? "No bookings in this range yet."
            : `Busiest slots — ${busiestCells}. Of ${busiest} at most in any one hour.`
        }
      />

      <HeatLegend
        caption="Bookings in that hour"
        emptyLabel="none"
        busiest={busiest}
        gutter={HOUR_GUTTER}
      />

      {hasOutside && (
        <p className="text-xs text-muted-foreground" style={{ paddingLeft: HOUR_GUTTER }}>
          Bookings outside 08:00–23:00 aren't shown.
        </p>
      )}
    </div>
  );
};
