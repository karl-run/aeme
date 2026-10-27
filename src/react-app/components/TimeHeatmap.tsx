import { defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { cell } from "@tanstack/charts/rect";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleOrdinal } from "@tanstack/charts/scales/ordinal";
import { tooltip } from "@tanstack/charts/tooltip";

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

/** One hue, dark to light, because the card underneath is nearly black: on a
 * dark surface a sequential ramp runs the other way round, with the busiest
 * cell the brightest thing in the grid. Validated against the card
 * (`#1d161e`) as an ordinal ramp — monotone lightness, every adjacent step
 * at least 0.06 apart in OKLCH L, and the dimmest step still 2.64:1 against
 * the card so a single booking never reads as an empty cell. */
const RAMP = ["#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd"] as const;

/** Never played: the `muted` token, which sits just far enough off the card
 * to draw the grid without joining the ramp. A count of zero is a different
 * statement from a low count, so it gets a color outside the scale. */
const EMPTY = "#2a212c";

const HOUR_ROW_HEIGHT = 20;
/** Room for the weekday labels above the grid. */
const AXIS_HEIGHT = 28;
/** Room for the hour labels down the left. */
const HOUR_GUTTER = 42;

/** How many steps of the ramp this grid uses: four, unless the busiest cell
 * holds fewer bookings than that, in which case every count gets a step of
 * its own and the legend reads 1, 2, 3 rather than inventing buckets no cell
 * can land in. The steps are sampled across the whole ramp rather than taken
 * off one end, so two of them are its darkest and its lightest and stay as
 * far apart as four would. */
const stepsFor = (busiest: number) => Math.max(1, Math.min(RAMP.length, busiest));

const rampFor = (steps: number) =>
  Array.from(
    { length: steps },
    (_, i) => RAMP[Math.round((i * (RAMP.length - 1)) / Math.max(1, steps - 1))],
  );

/** Which step a count lands on, counting from 1; 0 is "never", which isn't
 * on the ramp at all. Step b covers the counts in
 * `((b-1)·busiest/steps, b·busiest/steps]`. */
const bucketOf = (count: number, busiest: number) =>
  count === 0 ? 0 : Math.min(stepsFor(busiest), Math.ceil((count / busiest) * stepsFor(busiest)));

/** The counts a step covers, for the legend — the exact inverse of
 * `bucketOf`, so the labels partition the counts rather than overlapping at
 * every boundary. */
const bucketRange = (bucket: number, busiest: number) => {
  const steps = stepsFor(busiest);
  const low = Math.floor(((bucket - 1) * busiest) / steps) + 1;
  const high = Math.floor((bucket * busiest) / steps);
  return low >= high ? `${high}` : `${low}–${high}`;
};

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

      {/* The color scale spelled out: without it the grid shows a shape but
          no magnitude, and the tooltip only reaches one cell at a time. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[42px] text-xs text-muted-foreground">
        <span>Bookings in that hour:</span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[2px]" style={{ backgroundColor: EMPTY }} />
          none
        </span>
        {/* Nothing in the window means nothing for the ramp to stand for —
            the caption below is the whole story in that case. */}
        {busiest > 0 &&
          steps.map((color, index) => (
            <span key={color} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-3 rounded-[2px]"
                style={{ backgroundColor: color }}
              />
              {bucketRange(index + 1, busiest)}
            </span>
          ))}
      </div>

      {hasOutside && (
        <p className="pl-[42px] text-xs text-muted-foreground">
          Bookings outside 08:00–23:00 aren't shown.
        </p>
      )}
    </div>
  );
};
