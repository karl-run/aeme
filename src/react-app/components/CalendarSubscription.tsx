import { CheckIcon, CopyIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCalendarFeedQuery, useIssueCalendarFeedMutation } from "../queries/calendarFeed.ts";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";

const COPIED_RESET_MS = 2000;

/** Subscribe your own calendar to the bookings you're on.
 *
 * The URL is the credential — Google and Apple fetch it from their servers
 * with no session to speak of — so this is the one place it's shown, and
 * regenerating is the only way to take a leaked one out of circulation. */
export const CalendarSubscription = () => {
  const feed = useCalendarFeedQuery();
  const issue = useIssueCalendarFeedMutation();
  const [copied, setCopied] = useState(false);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(copiedTimerRef.current), []);

  const url = feed.data ?? null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      // Clipboard access can be refused outright; the field is selectable, so
      // there's still a way to get the URL out.
    }
  };

  if (feed.isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (feed.isError) {
    return <p className="text-sm text-muted-foreground">Couldn't load your calendar link.</p>;
  }

  if (!url) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          Get a private link your calendar app can follow. Every booking you're on shows up in your
          own calendar, and keeps up as plans change.
        </p>
        <Button type="button" disabled={issue.isPending} onClick={() => issue.mutate()}>
          {issue.isPending ? "Creating…" : "Create my calendar link"}
        </Button>
        {issue.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            Couldn't create the link.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={url}
          aria-label="Your calendar subscription link"
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={copied ? "Copied" : "Copy link"}
          title={copied ? "Copied" : "Copy link"}
          onClick={copy}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Paste the link where your calendar asks to subscribe by URL. Treat it like a password —
        anyone who has it can read your bookings. Google decides for itself how often to check,
        often only every several hours, so a brand-new booking won't be there right away; Apple
        checks as often as you tell it to.
      </p>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {confirmingRegenerate ? (
          <>
            <p className="text-sm text-muted-foreground">
              The old link stops working and every calendar using it goes blank.
            </p>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={issue.isPending}
              onClick={() =>
                issue.mutate(undefined, { onSettled: () => setConfirmingRegenerate(false) })
              }
            >
              {issue.isPending ? "Regenerating…" : "Yes, regenerate"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingRegenerate(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirmingRegenerate(true)}
          >
            <RotateCwIcon data-icon="inline-start" />
            Regenerate link
          </Button>
        )}
      </div>

      {issue.isError && (
        <p className="text-sm text-destructive" aria-live="polite">
          Couldn't regenerate the link.
        </p>
      )}
    </div>
  );
};
