/** Tailwind classes for an availability slot filled solid by how many other
 * users picked it — same solid-fill treatment as "your own" selection, just
 * a different hue, with intensity stepping up slightly with count. */
const OTHERS_TIERS = [
  { min: 1, border: "border-emerald-800", fill: "bg-emerald-800 hover:bg-emerald-800/90" },
  { min: 2, border: "border-emerald-900", fill: "bg-emerald-900 hover:bg-emerald-900/90" },
  { min: 4, border: "border-emerald-950", fill: "bg-emerald-950 hover:bg-emerald-950/90" },
] as const;

const othersTier = (count: number) =>
  [...OTHERS_TIERS].reverse().find((tier) => count >= tier.min) ?? OTHERS_TIERS[0];

export const othersSlotClass = (count: number) => {
  const tier = othersTier(count);
  return `${tier.border} ${tier.fill}`;
};

/** Just the fill from `othersSlotClass`, for grids whose cells keep their
 * own neutral border so the hour lines stay visible through a run of
 * filled cells. */
export const othersSlotFillClass = (count: number) => othersTier(count).fill;

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

/** A slot the viewer can't pick because it's at the activity's max. Replaces
 * the slot's usual fill rather than layering on it: "can't pick this" is the
 * one thing worth reading at a glance, and who's in it is on hover. */
export const fullSlotClass =
  "cursor-not-allowed border-solid border-muted-foreground/40 bg-muted bg-full-stripes text-muted-foreground";

/** Overlay marking a day-mode slot (a whole cell) that has an actual
 * booking — a thick dotted green outline, layered on top of (not replacing)
 * the cell's own fill/border. */
export const bookedSlotOverlayClass =
  "pointer-events-none absolute inset-0 rounded-[inherit] border-[3px] border-dotted border-green-500";

/** Overlay for a single booking on an hourly grid, sized/positioned via
 * inline `top`/`height` (see `bookingOverlayPercent`) so it's proportional
 * to the booking's actual start/end minutes rather than snapping to whole
 * hour-cell boundaries — a 30-minute booking reads as visibly smaller than a
 * 2-hour one instead of both filling a full cell. */
export const bookingOverlayClass =
  "pointer-events-none absolute inset-x-0 rounded-sm border-[3px] border-dotted border-green-500";
