import { type FormEvent, useState } from "react";

import { useCreateActivityMutation } from "../queries/activities.ts";
import { Button } from "./ui/button.tsx";
import { Checkbox } from "./ui/checkbox.tsx";
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
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";
import { Textarea } from "./ui/textarea.tsx";

export const AddActivityDialog = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [endTime, setEndTime] = useState("");
  const [persistent, setPersistent] = useState(false);
  const [slotGranularity, setSlotGranularity] = useState<"day" | "hourly">("day");

  const createActivity = useCreateActivityMutation();

  const reset = () => {
    setTitle("");
    setDescription("");
    setEndTime("");
    setPersistent(false);
    setSlotGranularity("day");
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    createActivity.mutate(
      {
        title,
        description,
        endTime: persistent ? null : endTime || null,
        persistent,
        slotGranularity,
      },
      {
        onSuccess: () => {
          reset();
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>Add activity</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add activity</DialogTitle>
          <DialogDescription>Create a new activity for this channel.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activity-title">Title</Label>
            <Input
              id="activity-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activity-description">Description</Label>
            <Textarea
              id="activity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="activity-persistent"
              checked={persistent}
              onCheckedChange={setPersistent}
            />
            <Label htmlFor="activity-persistent">Persistent (no end time)</Label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Availability type</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="slot-granularity"
                  checked={slotGranularity === "day"}
                  onChange={() => setSlotGranularity("day")}
                />
                Any time that day
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="slot-granularity"
                  checked={slotGranularity === "hourly"}
                  onChange={() => setSlotGranularity("hourly")}
                />
                Specific hours
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activity-end-time">End time</Label>
            <Input
              id="activity-end-time"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={persistent}
              required={!persistent}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={createActivity.isPending}>
              {createActivity.isPending ? "Adding…" : "Add activity"}
            </Button>
          </DialogFooter>

          {createActivity.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              Failed to add activity.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
