import { barX, defineChart, text } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";

/** `@tanstack/charts` may only be imported from a module that is itself
 * lazily imported — this one and `TimeHeatmap.tsx` — or the chart library
 * joins the main bundle again. See the lazy imports in `BookingStatsDialog.tsx`. */

export type CountRow = {
  key: string;
  name: string;
  count: number;
};

/** One measure, so one color for every bar: a hue per row would spend the
 * color channel on what the axis labels already say, and read as a ranking
 * that isn't there. Slot 1 of the app's own palette (`USER_COLORS`), at
 * 5.17:1 against the card. */
const BAR_COLOR = "#2563eb";

/** Bars stay thin and the plot grows instead, so ten rows don't produce ten
 * fat slabs. Row pitch, not bar thickness — `maxThickness` caps that. */
const ROW_HEIGHT = 30;
/** Room for the value axis and its label beneath the plot. */
const AXIS_HEIGHT = 56;
/** Room past the longest bar for its tip label, which would otherwise be
 * drawn outside the viewBox. */
const VALUE_LABEL_WIDTH = 34;
/** Longest axis label before it gets an ellipsis. A free-text place can be a
 * pasted maps link, which would otherwise run straight through the plot. */
const MAX_LABEL = 22;

type Labelled = CountRow & { label: string };

/** Axis labels, shortened to fit and kept distinct.
 *
 * The band scale treats the label as the category, so two rows that shorten
 * to the same text would collapse into one bar. That's only reachable with
 * two very similar long names, and a visible "(2)" is a better answer than
 * silently losing a row — the tooltip carries the full name either way. */
const toLabelled = (rows: readonly CountRow[]): Labelled[] => {
  const seen = new Map<string, number>();

  return rows.map((row) => {
    const short =
      row.name.length > MAX_LABEL ? `${row.name.slice(0, MAX_LABEL - 1).trimEnd()}…` : row.name;
    const taken = seen.get(short) ?? 0;
    seen.set(short, taken + 1);

    return { ...row, label: taken === 0 ? short : `${short} (${taken + 1})` };
  });
};

/** Enough left margin for the longest label, measured crudely: the axis draws
 * at 11px, and the labels are latin text, so ~6.2px per character is close
 * enough and errs wide. */
const labelGutter = (rows: readonly Labelled[]) => {
  const longest = rows.reduce((max, row) => Math.max(max, row.label.length), 0);
  return Math.min(Math.max(longest * 6.2 + 14, 48), 180);
};

type Props = {
  rows: CountRow[];
  /** Past bookings in total — the number each bar is read against. */
  total: number;
  /** Under the value axis, e.g. "Bookings joined of 12". */
  axisLabel: string;
  /** The tooltip's one row, e.g. "Joined". */
  valueLabel: string;
  ariaLabel: string;
};

/** A horizontal bar per row, longest first — the shape both the people and
 * the places tallies take. */
export const CountBarChart = ({ rows, total, axisLabel, valueLabel, ariaLabel }: Props) => {
  const labelled = toLabelled(rows);

  const chart = defineChart({
    marks: [
      barX(labelled, {
        x: "count",
        y: "label",
        fill: BAR_COLOR,
        // Capped, with a pixel shaved off each categorical edge so touching
        // bars are separated by 2px of card rather than by a border.
        maxThickness: 24,
        inset: 1,
        // Square where it leaves the baseline, rounded at the data end.
        radius: { end: 4 },
      }),
      // The value at the tip: a dozen short numbers, no collisions, and it
      // saves reading every bar against the gridlines.
      text(labelled, {
        x: "count",
        y: "label",
        text: (row: Labelled) => String(row.count),
        anchor: "start",
        dx: 6,
        fontSize: 11,
        fill: "#71717a",
      }),
    ],
    scales: {
      x: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: {
          label: axisLabel,
          // These are counts: never label a tick "2.5".
          ticks: { format: (value: number) => (Number.isInteger(value) ? String(value) : "") },
        },
      },
      y: { scale: () => scaleBand().padding(0.25) },
    },
    // The plot is inset rather than sized to the SVG: the labels hang off the
    // left of it and the counts off the right, and neither is allowed to
    // spill past the edge.
    margin: {
      left: labelGutter(labelled),
      right: VALUE_LABEL_WIDTH,
      top: 4,
      bottom: AXIS_HEIGHT - 12,
    },
    theme: {
      foreground: "#3f3f46",
      muted: "#71717a",
      grid: "#e4e4e7",
    },
    // The default body labels raw channels, which reads "Bookings joined of
    // 7 / 5" over a row labelled "y" holding the name. Both marks sit on the
    // same datum, so one row off `points[0]` says it once, says it in words,
    // and can afford the full name the axis had to shorten.
    tooltip: {
      use: tooltip,
      content: (points) => {
        const row = points[0]?.datum;
        if (!row) return { rows: [] };

        return {
          title: row.name,
          rows: [{ label: valueLabel, value: `${row.count} of ${total}` }],
        };
      },
    },
  });

  return (
    <Chart
      definition={chart}
      height={labelled.length * ROW_HEIGHT + AXIS_HEIGHT}
      ariaLabel={ariaLabel}
      ariaDescription={rows.map((row) => `${row.name}: ${row.count} of ${total}`).join(", ")}
    />
  );
};
