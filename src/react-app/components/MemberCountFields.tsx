import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";

type Props = {
  idPrefix: string;
  ideal: string;
  max: string;
  onIdealChange: (value: string) => void;
  onMaxChange: (value: string) => void;
};

/** The ideal and max headcount inputs, both optional. The ideal can't exceed
 * the max — each input's `min`/`max` points at the other, so the browser
 * refuses to submit until it's fixed, matching the rule the server enforces. */
export const MemberCountFields = ({ idPrefix, ideal, max, onIdealChange, onMaxChange }: Props) => {
  const idealOverMax = ideal !== "" && max !== "" && Number(ideal) > Number(max);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-ideal-member-count`}>Ideal number of people</Label>
          <Input
            id={`${idPrefix}-ideal-member-count`}
            type="number"
            min={1}
            max={max === "" ? undefined : max}
            value={ideal}
            onChange={(e) => onIdealChange(e.target.value)}
            placeholder="Optional"
            aria-invalid={idealOverMax}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-max-member-count`}>Max number of people</Label>
          <Input
            id={`${idPrefix}-max-member-count`}
            type="number"
            min={ideal === "" ? 1 : ideal}
            value={max}
            onChange={(e) => onMaxChange(e.target.value)}
            placeholder="Optional"
            aria-invalid={idealOverMax}
          />
        </div>
      </div>
      {idealOverMax ? (
        <p className="text-sm text-destructive" aria-live="polite">
          The ideal number can't be more than the max.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          The ideal is just shown alongside the count. The max caps how many people a booking can
          include.
        </p>
      )}
    </div>
  );
};
