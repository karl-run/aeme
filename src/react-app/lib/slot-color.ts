/** Tailwind classes for an availability slot filled solid by how many other
 * users picked it — same solid-fill treatment as "your own" selection, just
 * a different hue, with intensity stepping up slightly with count. */
const OTHERS_TIERS = [
  { min: 1, classes: "border-emerald-800 bg-emerald-800 hover:bg-emerald-800/90" },
  { min: 2, classes: "border-emerald-900 bg-emerald-900 hover:bg-emerald-900/90" },
  { min: 4, classes: "border-emerald-950 bg-emerald-950 hover:bg-emerald-950/90" },
] as const;

export const othersSlotClass = (count: number) =>
  [...OTHERS_TIERS].reverse().find((tier) => count >= tier.min)?.classes ?? OTHERS_TIERS[0].classes;

/** Darkens a "your own" primary-filled slot when others picked it too, via
 * `brightness` filters so it works regardless of the primary color's hue. */
const MINE_WITH_OTHERS_TIERS = [
  { min: 1, classes: "brightness-90" },
  { min: 2, classes: "brightness-75" },
  { min: 4, classes: "brightness-60" },
] as const;

export const mineWithOthersClass = (count: number) =>
  count > 0
    ? ([...MINE_WITH_OTHERS_TIERS].reverse().find((tier) => count >= tier.min)?.classes ??
      MINE_WITH_OTHERS_TIERS[0].classes)
    : undefined;

/** Overlay marking a slot that has an actual booking — a thick dotted green
 * outline, layered on top of (not replacing) the cell's own fill/border.
 *
 * Adjacent booked hour-cells (same booking, or two touching bookings) should
 * read as one continuous outline rather than a stack of separate boxes, so
 * callers pass which of the top/bottom edges are actually the outer edge of
 * the booked run — the shared edge between two booked neighbors is omitted.
 * Left/right are always drawn: a booking never spans across days. */
export const bookedSlotOverlayClass = (
  edges: { top: boolean; bottom: boolean } = { top: true, bottom: true },
) =>
  [
    "pointer-events-none absolute inset-0 border-x-[3px] border-dotted border-green-500",
    edges.top && edges.bottom
      ? "rounded-[inherit] border-t-[3px] border-b-[3px]"
      : edges.top
        ? "rounded-t-sm border-t-[3px] border-b-0"
        : edges.bottom
          ? "rounded-b-sm border-b-[3px] border-t-0"
          : "border-t-0 border-b-0",
  ].join(" ");
