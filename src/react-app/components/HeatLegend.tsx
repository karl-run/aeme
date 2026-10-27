import { bucketRange, EMPTY, rampFor, stepsFor } from "../lib/heat-ramp.ts";

type Props = {
  /** What the numbers count, e.g. "Bookings in that hour" — the colon is
   * added here. */
  caption: string;
  /** What a cell with nothing in it means, in words: "none", "never". */
  emptyLabel: string;
  /** The largest count in the grid, which is what the buckets are cut from. */
  busiest: number;
  /** Left padding in pixels, matching the chart's own label gutter so the
   * swatches line up with the plot rather than with the edge of the card. */
  gutter: number;
};

/** A heatmap's color scale spelled out: without it the grid shows a shape
 * but no magnitude, and the tooltip only reaches one cell at a time. */
export const HeatLegend = ({ caption, emptyLabel, busiest, gutter }: Props) => {
  const steps = rampFor(stepsFor(busiest));

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
      style={{ paddingLeft: gutter }}
    >
      <span>{caption}:</span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-[2px]" style={{ backgroundColor: EMPTY }} />
        {emptyLabel}
      </span>
      {/* An empty grid means nothing for the ramp to stand for — whatever
          caption sits under the chart is the whole story in that case. */}
      {busiest > 0 &&
        steps.map((color, index) => (
          <span key={color} className="flex items-center gap-1.5">
            <span aria-hidden className="size-3 rounded-[2px]" style={{ backgroundColor: color }} />
            {bucketRange(index + 1, busiest)}
          </span>
        ))}
    </div>
  );
};
