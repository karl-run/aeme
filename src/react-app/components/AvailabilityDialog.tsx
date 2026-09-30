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
  const [declined, setDeclined] = useState(activity.declined);

  const upsertAvailability = useUpsertAvailabilityMutation();

  const closed = activity.endTime !== null && activity.endTime < new Date().toISOString();

  const handleChange = (next: ActivitySlot[]) => {
    setSlots(next);
    setDeclined(false);
  };

  const handleDecline = () => {
    setSlots([]);
    setDeclined(true);
    upsertAvailability.mutate(
      { activityId: activity.id, slots: [], declined: true },
      { onSuccess: () => setOpen(false) },
    );
  };

  const handleSave = () => {
    upsertAvailability.mutate(
      { activityId: activity.id, slots, declined: false },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSlots(activity.slots);
          setDeclined(activity.declined);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={activity.declined && !closed ? "text-destructive" : undefined}
          />
        }
      >
        {closed
          ? "View response"
          : activity.declined
            ? "Can't make it"
            : activity.slots.length > 0
              ? "Edit availability"
              : "I'm in"}
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

        {declined && !closed && (
          <p className="text-sm text-destructive">
            You've said you can't make it. Pick a day or hour below to change your mind.
          </p>
        )}

        <AvailabilityGrid
          activityId={activity.id}
          granularity={activity.slotGranularity}
          suggestedDates={activity.suggestedDates}
          value={slots}
          onChange={handleChange}
          readOnly={closed}
          othersCount={activity.othersCount}
          bookedSlots={activity.bookedSlots}
          bookings={activity.bookings}
          idealMemberCount={activity.idealMemberCount}
        />

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {closed ? "Close" : "Cancel"}
          </DialogClose>
          {!closed && (
            <>
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={upsertAvailability.isPending}
                onClick={handleDecline}
              >
                Can't make it
              </Button>
              <Button type="button" disabled={upsertAvailability.isPending} onClick={handleSave}>
                {upsertAvailability.isPending ? "Saving…" : "Save"}
              </Button>
            </>
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
