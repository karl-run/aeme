import type { ActivityWithAvailability } from "../queries/activities.ts";
import { AvailabilityDialog } from "./AvailabilityDialog.tsx";

const summarize = (activity: ActivityWithAvailability) => {
  if (activity.slots.length === 0) return "Not answered yet";

  const days = new Set(activity.slots.map((slot) => slot.date)).size;
  return `You're in for ${days} day${days === 1 ? "" : "s"}`;
};

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const formatDeadline = (endTime: string) =>
  new Date(endTime).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

type Props = {
  activity: ActivityWithAvailability;
};

export const ActivityCard = ({ activity }: Props) => (
  <div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="font-medium">{activity.title}</h3>
        {activity.description && (
          <p className="text-sm text-muted-foreground">{activity.description}</p>
        )}
        {activity.suggestedDates && activity.suggestedDates.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Suggested: {activity.suggestedDates.map(formatDate).join(", ")}
          </p>
        )}
      </div>
      {activity.endTime && (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          Respond by {formatDeadline(activity.endTime)}
        </span>
      )}
    </div>

    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{summarize(activity)}</span>
      <AvailabilityDialog activity={activity} />
    </div>
  </div>
);
