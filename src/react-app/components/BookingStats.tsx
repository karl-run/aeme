import { ChartColumnIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { useBookingStatsQuery } from "../queries/stats.ts";
import { LazyChunkBoundary } from "./LazyChunkBoundary.tsx";
import { Button } from "./ui/button.tsx";

/** The chart and `@tanstack/charts` behind it are a chunk of their own,
 * fetched when someone opens the stats — the dashboard and every other page
 * never pay for it. Both charts here are the same component, so opening the
 * panel costs one chunk however many tallies it ends up showing. */
const CountBarChart = lazy(() =>
  import("./CountBarChart.tsx").then((m) => ({ default: m.CountBarChart })),
);

type Props = {
  activityId: string;
  /** Past bookings, from the polled activity payload — lets the button say
   * how much history there is before anything is fetched, and lets the whole
   * panel stay hidden when there's none. */
  pastBookingCount: number;
};

/** What the finished bookings add up to: who keeps coming, and where it keeps
 * happening.
 *
 * Everything here is deferred. The counts are a pair of group-bys over the
 * whole history, so they're left off the polled activities payload and
 * fetched on the click; the chart library is a lazy import. Failures are
 * handled on their own — a failed fetch offers a retry, a failed chunk falls
 * back to a message — because neither should take the activity page with
 * it. */
export const BookingStats = ({ activityId, pastBookingCount }: Props) => {
  const [open, setOpen] = useState(false);
  const stats = useBookingStatsQuery(activityId, open);

  if (pastBookingCount === 0) return null;

  if (!open) {
    return (
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ChartColumnIcon data-icon="inline-start" />
          Show the regulars
        </Button>
      </div>
    );
  }

  // One place used every time is a fact the list of locations already tells
  // you; a chart of a single full-width bar isn't worth the room.
  const showLocations = (stats.data?.locations.length ?? 0) > 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {stats.data
            ? `Across ${stats.data.bookings} past booking${stats.data.bookings === 1 ? "" : "s"}.`
            : "Who's been joining past bookings."}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Hide
        </Button>
      </div>

      {stats.isError ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive" aria-live="polite">
            Failed to load the stats.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={stats.isFetching}
            onClick={() => stats.refetch()}
          >
            {stats.isFetching ? "Retrying…" : "Try again"}
          </Button>
        </div>
      ) : !stats.data ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading…
        </p>
      ) : stats.data.attendance.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one's been listed on a past booking yet.</p>
      ) : (
        <LazyChunkBoundary
          fallback={
            <p className="text-sm text-destructive" aria-live="polite">
              Couldn't load the charts. Reloading the page usually fixes it.
            </p>
          }
        >
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Drawing…
              </p>
            }
          >
            <div className="flex flex-col gap-5">
              <section className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">Regulars</h3>
                <CountBarChart
                  rows={stats.data.attendance}
                  total={stats.data.bookings}
                  axisLabel={`Bookings joined of ${stats.data.bookings}`}
                  valueLabel="Joined"
                  ariaLabel="Bookings joined per person"
                />
              </section>

              {showLocations && (
                <section className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold">Favourite spots</h3>
                  <CountBarChart
                    rows={stats.data.locations}
                    total={stats.data.bookings}
                    axisLabel={`Bookings played there of ${stats.data.bookings}`}
                    valueLabel="Played there"
                    ariaLabel="Bookings per location"
                  />
                </section>
              )}
            </div>
          </Suspense>
        </LazyChunkBoundary>
      )}
    </div>
  );
};
