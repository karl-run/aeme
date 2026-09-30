import { XIcon } from "lucide-react";
import { type FormEvent, type ReactElement, useState } from "react";

import { useUpdateActivityMutation } from "../queries/activities.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";
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

type Props = {
  activity: ActivityWithAvailability;
  trigger: ReactElement;
};

/** Lets the activity's creator edit title/description/ideal headcount, plus
 * (one-off only) the suggested dates — never the type, granularity, or
 * deadline, which are fixed at creation. */
export const EditActivityDialog = ({ activity, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [idealMemberCount, setIdealMemberCount] = useState(
    activity.idealMemberCount?.toString() ?? "",
  );
  const [suggestedDates, setSuggestedDates] = useState<string[]>(activity.suggestedDates ?? []);

  const updateActivity = useUpdateActivityMutation();

  const resetToInitial = () => {
    setTitle(activity.title);
    setDescription(activity.description);
    setIdealMemberCount(activity.idealMemberCount?.toString() ?? "");
    setSuggestedDates(activity.suggestedDates ?? []);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const cleanedSuggestedDates = [...new Set(suggestedDates.filter(Boolean))].sort();

    updateActivity.mutate(
      {
        activityId: activity.id,
        title,
        description,
        idealMemberCount: idealMemberCount ? Number(idealMemberCount) : null,
        suggestedDates:
          !activity.persistent && cleanedSuggestedDates.length > 0 ? cleanedSuggestedDates : null,
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-activity-ideal-member-count">
              Ideal number of people (optional)
            </Label>
            <Input
              id="edit-activity-ideal-member-count"
              type="number"
              min={1}
              value={idealMemberCount}
              onChange={(e) => setIdealMemberCount(e.target.value)}
              placeholder="e.g. 8"
            />
          </div>

          {!activity.persistent && (
            <div className="flex flex-col gap-1.5">
              <Label>Suggested dates</Label>
              <p className="text-xs text-muted-foreground">
                Leave empty to let people propose any date. Removing a date doesn't erase anyone's
                existing response for it — it just stops showing until the date is added back.
              </p>
              <div className="flex flex-col gap-2">
                {suggestedDates.map((date, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) =>
                        setSuggestedDates((dates) =>
                          dates.map((d, j) => (j === i ? e.target.value : d)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove date"
                      onClick={() => setSuggestedDates((dates) => dates.filter((_, j) => j !== i))}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSuggestedDates((dates) => [...dates, ""])}
                >
                  Add a suggested date
                </Button>
              </div>
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
