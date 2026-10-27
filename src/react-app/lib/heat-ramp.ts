/** The sequential ramp and the bucket arithmetic the stats heatmaps share —
 * `TimeHeatmap.tsx` and `CoAttendanceMatrix.tsx`.
 *
 * Plain logic with no `@tanstack/charts` import of its own, so sharing it
 * between those two lazily-imported modules doesn't drag the chart library
 * anywhere near the main bundle — see the note at the top of
 * `CountBarChart.tsx`. */

/** One hue, dark to light, because the card underneath is nearly black: on a
 * dark surface a sequential ramp runs the other way round, with the busiest
 * cell the brightest thing in the grid. Validated against the card
 * (`#1d161e`) as an ordinal ramp — monotone lightness, every adjacent step
 * at least 0.06 apart in OKLCH L, and the dimmest step still 2.64:1 against
 * the card so a single booking never reads as an empty cell. */
export const RAMP = ["#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd"] as const;

/** Nothing there at all: the `muted` token, which sits just far enough off
 * the card to draw the grid without joining the ramp. A count of zero is a
 * different statement from a low count, so it gets a color outside the
 * scale. */
export const EMPTY = "#2a212c";

/** How many steps of the ramp a grid uses: four, unless its busiest cell
 * holds fewer than that, in which case every count gets a step of its own
 * and the legend reads 1, 2, 3 rather than inventing buckets no cell can
 * land in. The steps are sampled across the whole ramp rather than taken off
 * one end, so two of them are its darkest and its lightest and stay as far
 * apart as four would. */
export const stepsFor = (busiest: number) => Math.max(1, Math.min(RAMP.length, busiest));

export const rampFor = (steps: number) =>
  Array.from(
    { length: steps },
    (_, i) => RAMP[Math.round((i * (RAMP.length - 1)) / Math.max(1, steps - 1))],
  );

/** Which step a count lands on, counting from 1; 0 is "none", which isn't on
 * the ramp at all. Step b covers the counts in
 * `((b-1)·busiest/steps, b·busiest/steps]`. */
export const bucketOf = (count: number, busiest: number) =>
  count === 0 ? 0 : Math.min(stepsFor(busiest), Math.ceil((count / busiest) * stepsFor(busiest)));

/** The counts a step covers, for the legend — the exact inverse of
 * `bucketOf`, so the labels partition the counts rather than overlapping at
 * every boundary. */
export const bucketRange = (bucket: number, busiest: number) => {
  const steps = stepsFor(busiest);
  const low = Math.floor(((bucket - 1) * busiest) / steps) + 1;
  const high = Math.floor((bucket * busiest) / steps);
  return low >= high ? `${high}` : `${low}–${high}`;
};
