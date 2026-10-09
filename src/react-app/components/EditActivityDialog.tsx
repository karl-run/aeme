import { CalendarIcon } from "lucide-react";
import { type FormEvent, type ReactElement, useState } from "react";

import { useUpdateActivityMutation } from "../queries/activities.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";
import { MemberCountFields } from "./MemberCountFields.tsx";
import { Button } from "./ui/button.tsx";
import { Calendar } from "./ui/calendar.tsx";
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet.tsx";
import { Textarea } from "./ui/textarea.tsx";

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatShortDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

type Props = {
  activity: ActivityWithAvailability;
  trigger: ReactElement;
};

/** Lets the activity's creator edit title/description/headcounts, plus
 * (one-off only) the suggested dates — never the type, granularity, or
 * deadline, which are fixed at creation. */
export const EditActivityDialog = ({ activity, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [idealMemberCount, setIdealMemberCount] = useState(
    activity.idealMemberCount?.toString() ?? "",
  );
  const [maxMemberCount, setMaxMemberCount] = useState(activity.maxMemberCount?.toString() ?? "");
  const [suggestedDates, setSuggestedDates] = useState<string[]>(activity.suggestedDates ?? []);
  const [datesOpen, setDatesOpen] = useState(false);

  const updateActivity = useUpdateActivityMutation();

  const resetToInitial = () => {
    setTitle(activity.title);
    setDescription(activity.description);
    setIdealMemberCount(activity.idealMemberCount?.toString() ?? "");
    setMaxMemberCount(activity.maxMemberCount?.toString() ?? "");
    setSuggestedDates(activity.suggestedDates ?? []);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    updateActivity.mutate(
      {
        activityId: activity.id,
        title,
        description,
        idealMemberCount: idealMemberCount ? Number(idealMemberCount) : null,
        maxMemberCount: maxMemberCount ? Number(maxMemberCount) : null,
        suggestedDates: !activity.persistent && suggestedDates.length > 0 ? suggestedDates : null,
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetToInitial();
      }}
    >
      <SheetTrigger render={trigger} />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit activity</SheetTitle>
          <SheetDescription>
            {activity.persistent ? "Ongoing activity" : "One-off request"} — the type can't be
            changed.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-activity-title">Title</Label>
            <Input
              id="edit-activity-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-activity-description">Description</Label>
            <Textarea
              id="edit-activity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <MemberCountFields
            idPrefix="edit-activity"
            ideal={idealMemberCount}
            max={maxMemberCount}
            onIdealChange={setIdealMemberCount}
            onMaxChange={setMaxMemberCount}
          />

          {!activity.persistent && (
            <div className="flex flex-col gap-1.5">
              <Label>Suggested dates</Label>
              <p className="text-xs text-muted-foreground">
                Leave empty to let people propose any date. Removing a date doesn't erase anyone's
                existing response for it — it just stops showing until the date is added back.
              </p>
              <Popover open={datesOpen} onOpenChange={setDatesOpen}>
                <PopoverTrigger
                  render={
                    <Button type="button" variant="outline" className="justify-start font-normal" />
                  }
                >
                  <CalendarIcon className="size-4 shrink-0" />
                  <span className="truncate">
                    {suggestedDates.length > 0 ? (
                      suggestedDates.map(formatShortDate).join(", ")
                    ) : (
                      <span className="text-muted-foreground">Pick dates</span>
                    )}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="multiple"
                    selected={suggestedDates.map((date) => new Date(`${date}T00:00:00`))}
                    onSelect={(dates) => setSuggestedDates((dates ?? []).map(toDateStr).sort())}
                    disabled={{ before: new Date() }}
                  />
                  <div className="flex justify-end border-t border-border p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={suggestedDates.length === 0}
                      onClick={() => setSuggestedDates([])}
                    >
                      Clear
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <SheetFooter>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
            <Button type="submit" disabled={updateActivity.isPending}>
              {updateActivity.isPending ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>

          {updateActivity.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              Failed to save changes.
            </p>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};
