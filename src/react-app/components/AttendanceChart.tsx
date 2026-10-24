import { barX, defineChart, text } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";

/** Everything `@tanstack/charts` pulls in lands in this module's chunk — see
 * the lazy import in `AttendanceStats.tsx`. Nothing else in the app may
 * import it, or the chart library joins the main bundle again. */

export type AttendanceRow = {
  key: string;
  name: string;
  attended: number;
};

/** One measure, so one color for every bar: a hue per person would spend the
 * color channel on what the axis labels already say, and read as a ranking
 * that isn't there. Slot 1 of the app's own palette (`USER_COLORS`), at
 * 5.17:1 against the card. */
const BAR_COLOR = "#2563eb";

/** Bars stay thin and the plot grows instead, so ten people don't produce ten
 * fat slabs. Row pitch, not bar thickness — `maxThickness` caps that. */
const ROW_HEIGHT = 30;
/** Room for the value axis and its label beneath the plot. */
const AXIS_HEIGHT = 56;
/** Room past the longest bar for its tip label, which would otherwise be
 * drawn outside the viewBox. */
const VALUE_LABEL_WIDTH = 34;

/** Enough left margin for the longest name, measured crudely: the axis draws
 * at 11px, and the names are latin text, so ~6.2px per character is close
 * enough and errs wide. Clamped so one long name can't eat the plot. */
const nameGutter = (rows: AttendanceRow[]) => {
  const longest = rows.reduce((max, row) => Math.max(max, row.name.length), 0);
  return Math.min(Math.max(longest * 6.2 + 14, 48), 180);
};

type Props = {
  rows: AttendanceRow[];
  /** Past bookings in total — the number each bar is read against. */
  bookings: number;
};

export const AttendanceChart = ({ rows, bookings }: Props) => {
  const chart = defineChart({
    marks: [
      barX(rows, {
        x: "attended",
        y: "name",
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
      text(rows, {
        x: "attended",
        y: "name",
        text: (row: AttendanceRow) => String(row.attended),
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
          label: `Bookings attended of ${bookings}`,
          // Attendance is a count: never label a tick "2.5".
          ticks: { format: (value: number) => (Number.isInteger(value) ? String(value) : "") },
        },
      },
      y: { scale: () => scaleBand().padding(0.25) },
    },
    // The plot is inset rather than sized to the SVG: the names hang off the
    // left of it and the counts off the right, and neither is allowed to
    // spill past the edge.
    margin: { left: nameGutter(rows), right: VALUE_LABEL_WIDTH, top: 4, bottom: AXIS_HEIGHT - 12 },
    theme: {
      foreground: "#3f3f46",
      muted: "#71717a",
      grid: "#e4e4e7",
    },
    tooltip,
  });

  return (
    <Chart
      definition={chart}
      height={rows.length * ROW_HEIGHT + AXIS_HEIGHT}
      ariaLabel="Attendance per person across past bookings"
      ariaDescription={rows.map((row) => `${row.name}: ${row.attended} of ${bookings}`).join(", ")}
    />
  );
};
