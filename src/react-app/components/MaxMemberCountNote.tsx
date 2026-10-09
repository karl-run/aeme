type Props = {
  maxMemberCount: number;
  granularity: "day" | "hourly";
};

/** The line above a grid with a max, explaining the striped slots — with a
 * swatch of the stripes, so there's no doubt which ones it means. */
export const MaxMemberCountNote = ({ maxMemberCount, granularity }: Props) => {
  const unit = granularity === "day" ? "day" : "hour";

  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="size-3 shrink-0 rounded-sm border border-muted-foreground/40 bg-muted bg-full-stripes" />
      Max {maxMemberCount} {maxMemberCount === 1 ? "person" : "people"} per {unit} — striped {unit}s
      are full and can't be picked.
    </p>
  );
};
