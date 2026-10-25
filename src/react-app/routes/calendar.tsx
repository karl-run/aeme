import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { MonthCalendar, monthGridRange } from "../components/MonthCalendar.tsx";
import { PageContainer } from "../components/PageContainer.tsx";
import { PageLoader } from "../components/PageLoader.tsx";
import { Button } from "../components/ui/button.tsx";
import { useCalendarMonthQuery } from "../queries/calendar.ts";
import { useSessionQuery } from "../queries/session.ts";

type CalendarSearch = {
  /** The month on screen, as `YYYY-MM`. Absent means the current one.
   *
   * In the URL rather than in state so a month survives a reload, can be
   * shared, and leaves the back button meaning what it looks like it means. */
  month?: string;
};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const toMonthParam = (month: Date) => format(month, "yyyy-MM");

/** Whatever the URL asks for, or this month — a hand-edited `?month=` falls
 * back rather than rendering `Invalid Date`. */
const parseMonth = (raw: string | undefined) =>
  raw && MONTH_PATTERN.test(raw) ? new Date(`${raw}-01T00:00:00`) : startOfMonth(new Date());

const formatMonth = (month: Date) =>
  month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

const CalendarPage = () => {
  const { month: monthParam } = Route.useSearch();
  const navigate = useNavigate();
  const { data, isPending: sessionPending } = useSessionQuery();

  const session = data?.session;
  const month = parseMonth(monthParam);
  // One query per month, so browsing back through the year is a month's
  // worth of bookings at a time rather than the channel's whole history.
  const calendar = useCalendarMonthQuery(toMonthParam(month), monthGridRange(month), !!session);

  const goToMonth = (next: Date) =>
    navigate({ to: "/calendar", search: { month: toMonthParam(next) } });

  if (sessionPending) return <PageLoader />;

  if (!session) {
    return (
      <PageContainer className="p-2 md:px-6">
        <div className="flex w-full max-w-prose flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            Log in to see what's booked. Run <code className="font-mono">/æme</code> in Slack for a
            login link.
          </p>
          <Button render={<Link to="/" />} nativeButton={false} variant="outline" size="sm">
            Back to dashboard
          </Button>
        </div>
      </PageContainer>
    );
  }

  const bookings = calendar.data ?? [];
  const thisMonth = isSameMonth(month, new Date());

  return (
    <PageContainer className="flex animate-in flex-col items-start gap-4 p-2 pb-10 fade-in duration-300 md:px-6">
      <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-xl font-semibold">{formatMonth(month)}</h1>
          {/* Fetching rather than pending: with the previous month held on
              screen while the next loads, this is the only sign anything is
              happening. */}
          {calendar.isFetching && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              Loading…
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => goToMonth(addMonths(month, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={thisMonth}
            onClick={() => goToMonth(startOfMonth(new Date()))}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => goToMonth(addMonths(month, 1))}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      {calendar.isError && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>Couldn't load this month.</span>
          <Button type="button" variant="outline" size="xs" onClick={() => calendar.refetch()}>
            Try again
          </Button>
        </div>
      )}

      <MonthCalendar month={month} bookings={bookings} />

      {!calendar.isPending && !calendar.isError && bookings.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing booked in {formatMonth(month)}.</p>
      )}
    </PageContainer>
  );
};

export const Route = createFileRoute("/calendar")({
  // Hand-rolled like the booking screen's: one optional string the component
  // re-checks against `MONTH_PATTERN` anyway.
  validateSearch: (search: Record<string, unknown>): CalendarSearch => ({
    month: typeof search.month === "string" ? search.month : undefined,
  }),
  component: CalendarPage,
});
