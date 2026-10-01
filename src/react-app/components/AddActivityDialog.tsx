import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useCreateActivityMutation } from "../queries/activities.ts";
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
import { Tabs, TabsIndicator, TabsList, TabsPanel, TabsTab } from "./ui/tabs.tsx";
import { Textarea } from "./ui/textarea.tsx";

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatShortDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const AddActivityDialog = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [endTime, setEndTime] = useState("");
  const [persistent, setPersistent] = useState(false);
  const [slotGranularity, setSlotGranularity] = useState<"day" | "hourly">("day");
  const [suggestedDates, setSuggestedDates] = useState<string[]>([]);
  const [datesOpen, setDatesOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [idealMemberCount, setIdealMemberCount] = useState("");
  // Set on the first submit attempt, so the deadline error only appears once
  // you've actually tried — not while you're still filling the form in.
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const createActivity = useCreateActivityMutation();

  // `endTime` stays a single "YYYY-MM-DDTHH:mm" string (what the API expects)
  // — these just split it for the two separate date/time controls.
  const endDatePart = endTime.split("T")[0] ?? "";
  const endTimePart = endTime.split("T")[1] ?? "16:00";

  const reset = () => {
    setTitle("");
    setDescription("");
    setEndTime("");
    setPersistent(false);
    setSlotGranularity("day");
    setSuggestedDates([]);
    setIdealMemberCount("");
    setSubmitAttempted(false);
  };

  // A one-off needs a deadline, but nothing in the form can say so natively:
  // the date side is a popover button rather than an input, and the time input
  // is disabled until a date is picked — and the browser skips disabled fields
  // when validating. So it's checked and reported by hand.
  //
  // The past-deadline case is checked here too, matching the rule the server
  // enforces: the calendar won't offer a past date, but picking today and an
  // hour that's already gone otherwise fails with a generic "Failed to add
  // activity" long after the fact.
  const deadlineError = persistent
    ? null
    : endTime === ""
      ? "Pick a date and time for people to respond by."
      : new Date(endTime) < new Date()
        ? "That time has already passed — pick a later one."
        : null;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (deadlineError) return;

    createActivity.mutate(
      {
        title,
        description,
        // `endTime` is the creator's wall clock; the API stores instants.
        endTime: persistent || endTime === "" ? null : new Date(endTime).toISOString(),
        persistent,
        slotGranularity,
        suggestedDates: !persistent && suggestedDates.length > 0 ? suggestedDates : null,
        idealMemberCount: idealMemberCount ? Number(idealMemberCount) : null,
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
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <SheetTrigger render={<Button size="sm" />}>Add activity</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add activity</SheetTitle>
          <SheetDescription>Create a new activity for this channel.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
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
            <Label htmlFor="activity-ideal-member-count">Ideal number of people (optional)</Label>
            <Input
              id="activity-ideal-member-count"
              type="number"
              min={1}
              value={idealMemberCount}
              onChange={(e) => setIdealMemberCount(e.target.value)}
              placeholder="e.g. 8"
            />
            <p className="text-xs text-muted-foreground">
              Just shown alongside the count — doesn't limit who can join.
            </p>
          </div>

          <Tabs
            value={persistent ? "ongoing" : "one-off"}
            onValueChange={(value) => setPersistent(value === "ongoing")}
          >
            <TabsList>
              <TabsTab value="one-off">One-off</TabsTab>
              <TabsTab value="ongoing">Ongoing</TabsTab>
              <TabsIndicator />
            </TabsList>

            <TabsPanel value="one-off" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Suggested dates (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Pick a few candidate dates, e.g. the 12th, 14th or 16th. Leave empty to let people
                  propose any date.
                </p>
                <Popover open={datesOpen} onOpenChange={setDatesOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-start font-normal"
                      />
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

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="activity-end-time">Respond by</Label>
                <div className="flex gap-2">
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          aria-invalid={submitAttempted && deadlineError !== null}
                          className="flex-1 justify-start font-normal"
                        />
                      }
                    >
                      <CalendarIcon className="size-4 shrink-0" />
                      {endDatePart ? (
                        format(new Date(`${endDatePart}T00:00:00`), "PPP")
                      ) : (
                        <span className="text-muted-foreground">Pick a date</span>
                      )}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        required
                        selected={endDatePart ? new Date(`${endDatePart}T00:00:00`) : undefined}
                        onSelect={(date) => {
                          setEndTime(`${toDateStr(date)}T${endTimePart}`);
                          setEndDateOpen(false);
                        }}
                        disabled={{ before: new Date() }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    id="activity-end-time"
                    type="time"
                    value={endTimePart}
                    onChange={(e) =>
                      setEndTime(endDatePart ? `${endDatePart}T${e.target.value}` : "")
                    }
                    disabled={!endDatePart}
                    required={!persistent}
                    aria-invalid={submitAttempted && deadlineError !== null}
                    className="w-32"
                  />
                </div>
                {submitAttempted && deadlineError && (
                  <p className="text-sm text-destructive" aria-live="polite">
                    {deadlineError}
                  </p>
                )}
              </div>
            </TabsPanel>

            <TabsPanel value="ongoing">
              <p className="text-sm text-muted-foreground">
                Runs indefinitely, with no deadline to respond by.
              </p>
            </TabsPanel>
          </Tabs>

          <SheetFooter>
            <SheetClose render={<Button type="button" variant="outline" />}>Cancel</SheetClose>
            <Button type="submit" disabled={createActivity.isPending}>
              {createActivity.isPending ? "Adding…" : "Add activity"}
            </Button>
          </SheetFooter>

          {createActivity.isError && (
            <p className="text-sm text-destructive" aria-live="polite">
              Failed to add activity.
            </p>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
};
