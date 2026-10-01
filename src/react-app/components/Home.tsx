import { Link } from "@tanstack/react-router";

import { nextBookingTime, oneOffBucket } from "../lib/activity-state.ts";
import { useActivitiesQuery } from "../queries/activities.ts";
import { useSessionQuery } from "../queries/session.ts";
import { ActivityCard } from "./ActivityCard.tsx";
import { OngoingBoard } from "./OngoingBoard.tsx";
import { PageContainer } from "./PageContainer.tsx";

export const Home = () => {
  const { data, isPending } = useSessionQuery();
  const activities = useActivitiesQuery();

  if (isPending) return null;

  const session = data?.session;

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 mt-20 text-center">
        <h1 className="text-2xl font-semibold">You're not logged in</h1>
        <p className="max-w-sm text-zinc-400">
          Open Slack and run the <code className="font-mono text-zinc-200">/æme</code> command in
          any channel to get a login link.
        </p>
        <p className="text-sm text-zinc-400">
          Have an OTP code?{" "}
          <Link to="/login" className="underline">
            Log in
          </Link>
        </p>
      </div>
    );
  }

  const all = activities.data ?? [];
  const ongoing = all.filter((activity) => activity.persistent);
  const requests = all
    .filter((activity) => !activity.persistent)
    .sort((a, b) => (a.endTime ?? "").localeCompare(b.endTime ?? ""));

  const openRequests = requests.filter((activity) => oneOffBucket(activity) === "open");
  // Soonest event first — once a request is locked in, the deadline it closed
  // on stops being the interesting date.
  const lockedRequests = requests
    .filter((activity) => oneOffBucket(activity) === "locked")
    .sort((a, b) => nextBookingTime(a) - nextBookingTime(b));
  const pastRequests = requests.filter((activity) => oneOffBucket(activity) === "past");

  return (
    <PageContainer className="flex flex-col items-start gap-6 p-2 md:px-6">
      <section className="flex w-full flex-col gap-3">
        <h2 className="text-lg font-semibold">Ongoing</h2>
        <OngoingBoard activities={ongoing} />
      </section>

      <section className="flex w-full max-w-2xl flex-col gap-3">
        <h2 className="text-lg font-semibold">Requests</h2>
        {openRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open requests.</p>
        ) : (
          openRequests.map((activity) => <ActivityCard key={activity.id} activity={activity} />)
        )}
      </section>

      {lockedRequests.length > 0 && (
        <section className="flex w-full max-w-2xl flex-col gap-3">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold">Booked</h2>
            <p className="text-sm text-muted-foreground">
              Responses are closed, but these haven't happened yet.
            </p>
          </div>
          {lockedRequests.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </section>
      )}

      {pastRequests.length > 0 && (
        <section className="w-full max-w-2xl">
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">Past requests ({pastRequests.length})</summary>
            <div className="mt-3 flex flex-col gap-3">
              {pastRequests.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </details>
        </section>
      )}
    </PageContainer>
  );
};
