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
