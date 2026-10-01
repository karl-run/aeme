import { cn } from "cn";

import { offersOnDate, respondedDates } from "../lib/responders.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";

const formatWeekday = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });

const formatDay = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

type Choice = {
  date: string;
  count: number;
  names: string[];
  booked: boolean;
};

type Props = {
  activity: ActivityWithAvailability;
  value: string;
  onChange: (date: string) => void;
};

const ChoiceGroup = ({
  label,
  hint,
  choices,
  value,
  best,
  onChange,
}: {
  label: string;
  hint?: string;
  choices: Choice[];
  value: string;
  best: number;
  onChange: (date: string) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-xs font-medium text-muted-foreground">
      {label}
      {hint && <span className="font-normal"> · {hint}</span>}
    </p>
    <div className="flex flex-wrap gap-2">
      {choices.map((choice) => {
        const selected = choice.date === value;
        return (
          <button
            key={choice.date}
            type="button"
            onClick={() => onChange(choice.date)}
            title={choice.count > 0 ? choice.names.join(", ") : "No one has picked this day."}
            className={cn(
              "flex min-w-24 flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted",
            )}
          >
            <span className="text-xs opacity-70">{formatWeekday(choice.date)}</span>
            <span className="text-sm font-medium">{formatDay(choice.date)}</span>
            <span className="flex items-center gap-1 text-[10px]">
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-medium",
                  choice.count === 0
                    ? "bg-muted text-muted-foreground"
                    : selected
                      ? "bg-primary-foreground/20"
                      : "bg-emerald-800 text-primary-foreground",
                )}
              >
                {choice.count} in
              </span>
              {choice.count > 0 && choice.count === best && (
                <span className="opacity-70">most</span>
              )}
              {choice.booked && <span className="text-green-500">booked</span>}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

/** Day picker for a one-off activity, where the question isn't "what date?"
 * in the abstract but "which of the days people answered about?". Suggested
 * dates come first and always show, even with nobody on them — they're the
 * question that was actually asked. Days people proposed themselves follow,
 * most-available first. */
export const BookingDateChoices = ({ activity, value, onChange }: Props) => {
  const bookedDates = new Set(activity.bookings.map((booking) => booking.date));

  const toChoice = (date: string): Choice => {
    const offers = offersOnDate(activity.responses, date);
    return {
      date,
      count: offers.length,
      names: offers.map((offer) => offer.name),
      booked: bookedDates.has(date),
    };
  };

  const suggested = [...(activity.suggestedDates ?? [])].sort().map(toChoice);

  const suggestedSet = new Set(activity.suggestedDates ?? []);
  const proposed = respondedDates(activity.responses)
    .filter((date) => !suggestedSet.has(date))
    .map(toChoice)
    .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date));

  if (suggested.length === 0 && proposed.length === 0) return null;

  // One scale across both groups, so "most" means most overall rather than
  // most within its own row.
  const best = Math.max(0, ...[...suggested, ...proposed].map((choice) => choice.count));

  return (
    <div className="flex flex-col gap-3">
      {suggested.length > 0 && (
        <ChoiceGroup
          label="Suggested dates"
          hint="what everyone was asked about"
          choices={suggested}
          value={value}
          best={best}
          onChange={onChange}
        />
      )}
      {proposed.length > 0 && (
        <ChoiceGroup
          label={suggested.length > 0 ? "Other days people picked" : "Days people picked"}
          choices={proposed}
          value={value}
          best={best}
          onChange={onChange}
        />
      )}
    </div>
  );
};
