type Props = {
  /** The visible hours, each rendered by the grid as one `cellPx`-tall cell. */
  hours: number[];
  cellPx: number;
};

const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** The hour labels beside a vertical hour grid. Each label sits on the line
 * where its hour starts, not in the middle of the cell, so a cell reads as
 * "from this line to the next". That's why there's one more label than there
 * are cells: the bottom line is where the last hour ends (e.g. 24:00). */
export const HourAxis = ({ hours, cellPx }: Props) => {
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
          className="absolute right-2 -translate-y-1/2 text-xs leading-none text-muted-foreground"
          style={{ top: i * cellPx }}
        >
          {formatHour(hour)}
        </span>
      ))}
    </div>
  );
};
