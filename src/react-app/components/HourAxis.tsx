import { cn } from "cn";

type Props = {
  /** The visible hours, each rendered by the grid as one `cellPx`-tall cell. */
  hours: number[];
  cellPx: number;
  /** The hour whose cell is hovered: the lines it spans, its start and its
   * end, get their labels emphasized. */
  highlightHour?: number | null;
};

const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** The hour labels beside a vertical hour grid. Each label sits on the line
 * where its hour starts, not in the middle of the cell, so a cell reads as
 * "from this line to the next". That's why there's one more label than there
 * are cells: the bottom line is where the last hour ends (e.g. 24:00). */
export const HourAxis = ({ hours, cellPx, highlightHour }: Props) => {
  const lines = [...hours, hours[hours.length - 1] + 1];

  return (
    <div className="relative" style={{ height: hours.length * cellPx }}>
      {/* The labels are absolutely positioned and so take up no width; this
          invisible one does, so an `auto`-sized grid column doesn't collapse
          to nothing and clip them. */}
      <span aria-hidden className="invisible block pr-2 text-xs leading-none">
        00:00
      </span>
      {lines.map((hour, i) => (
        <span
          key={hour}
          className={cn(
            "absolute right-2 -translate-y-1/2 text-xs leading-none text-muted-foreground",
            (hour === highlightHour || hour - 1 === highlightHour) &&
              "font-semibold text-foreground",
          )}
          style={{ top: i * cellPx }}
        >
          {formatHour(hour)}
        </span>
      ))}
    </div>
  );
};

/** Border colors that pick out the hovered hour's row in a grid of hour
 * cells, so it's easy to tell which hour a cell is. The lines above and below
 * the row are each two cell borders back to back (the row's own and its
 * neighbor's), so darkening both makes them read as heavier while keeping
 * the grid's own line style. */
export const hourRowLineClass = (hour: number, hoveredHour: number | null) =>
  cn(
    hour === hoveredHour && "border-y-muted-foreground",
    hour + 1 === hoveredHour && "border-b-muted-foreground",
    hour - 1 === hoveredHour && "border-t-muted-foreground",
  );
