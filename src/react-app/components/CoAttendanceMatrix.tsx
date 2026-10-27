import { defineChart, text } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { cell } from "@tanstack/charts/rect";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleOrdinal } from "@tanstack/charts/scales/ordinal";
import { tooltip } from "@tanstack/charts/tooltip";

import { bucketOf, EMPTY, rampFor, stepsFor } from "../lib/heat-ramp.ts";
import { textColorOn } from "../lib/user-color.ts";
import type { CountRow } from "./CountBarChart.tsx";
import { HeatLegend } from "./HeatLegend.tsx";

/** Like the other two chart modules, this one is only ever reached through
 * the lazy import in `BookingStats.tsx` — see the note in
 * `CountBarChart.tsx`. */

/** Two people and how many past bookings they were both on. `a` and `b` are
 * `CountRow.key`s, lexicographically ordered, and the pair is listed once
 * rather than once per direction. */
export type AttendancePair = {
  a: string;
  b: string;
  count: number;
};

/** How many people the matrix draws. Past a dozen the columns are too narrow
 * for a name and the grid is too big to scan across; the regulars chart
 * above already names everyone. Taken off the top of the attendance order,
 * so what's dropped is whoever came least. */
export const MAX_PEOPLE = 12;

/** Row pitch. Cells are as wide as the plot allows, so this is the only
 * dimension fixed here. */
const ROW_HEIGHT = 30;
/** Per character of a name, at the 11px the axis draws — the same crude
 * latin-text measure `CountBarChart` uses, and it errs wide the same way. */
const LABEL_PX_PER_CHAR = 6.2;
/** Names across the top are rotated 45°, so what they cost in height is
 * their width times sin 45° rather than their width. */
const ROTATED = Math.sin(Math.PI / 4);

type Person = CountRow & { label: string };

/** First names, because both axes are made of them — a matrix has nowhere to
 * put the full name the regulars chart can afford down one side.
 *
 * Someone who shares a first name gets the next initial after it ("Karl O."),
 * and anything still equal after that gets a number, which is the answer
 * `CountBarChart` gives too: a visible "(2)" beats two people silently
 * sharing a row. The band scales key off these, so two people landing on the
 * same label would collapse into one row *and* one column. */
const shortNames = (people: readonly CountRow[]): Person[] => {
  const words = people.map((person) => person.name.trim().split(/\s+/));

  // Who needs more than a first name: only the ones sharing theirs.
  const sharing = new Map<string, number>();
  for (const parts of words) sharing.set(parts[0], (sharing.get(parts[0]) ?? 0) + 1);

  const taken = new Map<string, number>();

  return people.map((person, index) => {
    const [first, second] = words[index];
    const base =
      (sharing.get(first) ?? 0) > 1 && second
        ? `${first} ${second.charAt(0).toUpperCase()}.`
        : first;
    const seen = taken.get(base) ?? 0;
    taken.set(base, seen + 1);

    return { ...person, label: seen === 0 ? base : `${base} (${seen + 1})` };
  });
};

type Cell = {
  rowKey: string;
  colKey: string;
  rowLabel: string;
  colLabel: string;
  rowName: string;
  colName: string;
  /** Each person's own total, so a cell can be read against what the two of
   * them have each turned up to. */
  rowTotal: number;
  colTotal: number;
  count: number;
  bucket: number;
};

type Props = {
  /** The attendance tally, most-attended first — the same rows the regulars
   * chart draws. It supplies the order of both axes and the names the pair
   * keys resolve to. */
  people: readonly CountRow[];
  pairs: readonly AttendancePair[];
  ariaLabel: string;
};

/** Who turns up with whom: the same people down the side and across the top,
 * each cell holding the bookings the two of them were both on.
 *
 * A matrix rather than a network diagram because it's the pair that's being
 * asked about, and a matrix answers for every pair at once — including the
 * ones that never happened, which a diagram draws as the absence of a line
 * and is easy to miss. It also doesn't move between renders.
 *
 * The diagonal is left out of the data entirely rather than drawn in some
 * "not applicable" color: no mark means the card shows through, which is the
 * plainest way to say the question doesn't apply there. */
export const CoAttendanceMatrix = ({ people, pairs, ariaLabel }: Props) => {
  const shown = shortNames(people.slice(0, MAX_PEOPLE));

  const counts = new Map(pairs.map((pair) => [`${pair.a}|${pair.b}`, pair.count]));
  const together = (a: Person, b: Person) =>
    counts.get(a.key < b.key ? `${a.key}|${b.key}` : `${b.key}|${a.key}`) ?? 0;

  const cells = shown.flatMap((row) =>
    shown
      .filter((col) => col.key !== row.key)
      .map((col) => ({
        rowKey: row.key,
        colKey: col.key,
        rowLabel: row.label,
        colLabel: col.label,
        rowName: row.name,
        colName: col.name,
        rowTotal: row.count,
        colTotal: col.count,
        count: together(row, col),
      })),
  );

  // Off the cells on screen rather than off every pair the server sent: the
  // ramp has to be cut from what's actually drawn, or a pair involving
  // someone past `MAX_PEOPLE` would set a top of the scale no cell reaches.
  const busiest = cells.reduce((max, entry) => Math.max(max, entry.count), 0);
  const steps = rampFor(stepsFor(busiest));
  const grid: Cell[] = cells.map((entry) => ({
    ...entry,
    bucket: bucketOf(entry.count, busiest),
  }));

  // Both axes get the attendance order spelled out, as configured scale
  // instances rather than the factories the other charts hand over: a
  // factory has its domain inferred from the marks, which would read the
  // column order off the first row — and that row is missing its own
  // person, the diagonal having been dropped, so the two axes would come
  // out a step apart and the blanks would fall somewhere other than the
  // diagonal. The ranges stay the chart's to decide either way.
  const labels = shown.map((person) => person.label);

  const longest = shown.reduce((max, person) => Math.max(max, person.label.length), 0);
  // The plot is inset rather than sized to the SVG: the names hang off the
  // left of it and off the top, and neither may spill past the edge. Both
  // gutters are clamped, so one very long name can't squeeze the grid out.
  const nameGutter = Math.min(Math.max(longest * LABEL_PX_PER_CHAR + 12, 44), 120);
  const topGutter = Math.min(Math.round(longest * LABEL_PX_PER_CHAR * ROTATED) + 20, 100);

  const chart = defineChart({
    marks: [
      cell(grid, {
        x: "colLabel",
        y: "rowLabel",
        color: "bucket",
        // A pixel off each edge, so neighbouring cells are separated by the
        // card rather than running into one continuous wash.
        inset: 1,
        radius: 2,
      }),
      // The count in the cell. There are at most a dozen columns and the
      // numbers are one or two digits, so they fit where the hour grid's
      // hundred-odd cells couldn't — and it saves reading every cell against
      // the legend. Black or white per cell, since the ramp crosses from too
      // dark for black text to too light for white.
      text(
        grid.filter((entry) => entry.count > 0),
        {
          x: "colLabel",
          y: "rowLabel",
          text: (entry: Cell) => String(entry.count),
          fontSize: 11,
          fontWeight: 600,
          fill: (entry: Cell) => textColorOn(steps[entry.bucket - 1]),
        },
      ),
    ],
    scales: {
      // Names across the top, the way a table is headed. Rotated because a
      // dozen of them won't fit side by side, and explicitly un-thinned
      // because the default drops colliding labels — on a matrix that would
      // quietly leave columns unnamed.
      //
      // Rotated the way round that hangs each name up and to the left of its
      // column: ending at the tick and leaning back over the gutter, which
      // has room for it, rather than over the right margin, which is four
      // pixels wide, or down across the first row of cells.
      x: {
        scale: scaleBand(labels, [0, 1]).padding(0),
        side: "top",
        axis: { tickLabels: { rotate: 45, anchor: "end", thin: false } },
      },
      y: { scale: scaleBand(labels, [0, 1]).padding(0) },
    },
    // An explicit domain, so the ramp is pinned to the bucket number and not
    // to whichever buckets happen to occur.
    color: {
      scale: scaleOrdinal,
      domain: [0, ...steps.map((_, index) => index + 1)],
      range: [EMPTY, ...steps],
    },
    margin: { left: nameGutter, right: 4, top: topGutter, bottom: 4 },
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
          title: `${datum.rowName} & ${datum.colName}`,
          rows: [
            {
              label: "Together",
              value:
                datum.count === 0
                  ? "never"
                  : `${datum.count} booking${datum.count === 1 ? "" : "s"}`,
            },
            // Five together means one thing for someone who's been to six and
            // another for someone who's been to forty, so both totals come
            // with it rather than leaving the cell to be read on its own.
            { label: datum.rowName, value: `${datum.rowTotal} in total` },
            { label: datum.colName, value: `${datum.colTotal} in total` },
          ],
        };
      },
    },
  });

  // The closest few, so a screen reader gets the headline rather than every
  // cell of a grid that's mostly mirror image. One of each mirrored pair.
  const closest = grid
    .filter((entry) => entry.rowKey < entry.colKey && entry.count > 0)
    .sort((a, b) => b.count - a.count || a.rowName.localeCompare(b.rowName))
    .slice(0, 3)
    .map((entry) => `${entry.rowName} and ${entry.colName}: ${entry.count}`)
    .join(", ");

  return (
    <div className="flex flex-col gap-2">
      <Chart
        definition={chart}
        height={shown.length * ROW_HEIGHT + topGutter}
        ariaLabel={ariaLabel}
        ariaDescription={
          closest === ""
            ? "No two people have been on the same booking yet."
            : `Most often together — ${closest}.`
        }
      />

      <HeatLegend
        caption="Bookings together"
        emptyLabel="never"
        busiest={busiest}
        gutter={nameGutter}
      />

      {people.length > MAX_PEOPLE && (
        <p className="text-xs text-muted-foreground" style={{ paddingLeft: nameGutter }}>
          The {MAX_PEOPLE} most frequent of {people.length}.
        </p>
      )}
    </div>
  );
};
