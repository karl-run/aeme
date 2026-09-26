import { useState } from "react";

import type { ActivitySlot } from "../../worker/db/schema.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";
import { useUpsertAvailabilityMutation } from "../queries/availability.ts";
import { AvailabilityGrid } from "./AvailabilityGrid.tsx";
import { Button } from "./ui/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog.tsx";

type Props = {
  activity: ActivityWithAvailability;
};

export const AvailabilityDialog = ({ activity }: Props) => {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<ActivitySlot[]>(activity.slots);

  const upsertAvailability = useUpsertAvailabilityMutation();

  const closed = activity.endTime !== null && activity.endTime < new Date().toISOString();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSlots(activity.slots);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {closed ? "View response" : activity.slots.length > 0 ? "Edit availability" : "I'm in"}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{activity.title}</DialogTitle>
          <DialogDescription>
            {closed
              ? "Responses are closed."
              : activity.slotGranularity === "day"
                ? "Pick the days you can make it."
                : "Pick the hours you're available."}
          </DialogDescription>
        </DialogHeader>

        <AvailabilityGrid
          granularity={activity.slotGranularity}
          suggestedDates={activity.suggestedDates}
          value={slots}
          onChange={setSlots}
          readOnly={closed}
        />

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {closed ? "Close" : "Cancel"}
          </DialogClose>
          {!closed && (
            <Button
              type="button"
              disabled={upsertAvailability.isPending}
              onClick={() =>
                upsertAvailability.mutate(
                  { activityId: activity.id, slots },
                  { onSuccess: () => setOpen(false) },
                )
              }
            >
              {upsertAvailability.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </DialogFooter>

        {upsertAvailability.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            Failed to save availability.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
