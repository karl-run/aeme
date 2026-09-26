import { Link } from "@tanstack/react-router";

import { type ActivityWithAvailability, useActivitiesQuery } from "../queries/activities.ts";
import { useSessionQuery } from "../queries/session.ts";
import { ActivityCard } from "./ActivityCard.tsx";
import { AddActivityDialog } from "./AddActivityDialog.tsx";

const isPast = (activity: ActivityWithAvailability) =>
  activity.endTime !== null && activity.endTime < new Date().toISOString();

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
  const openRequests = requests.filter((activity) => !isPast(activity));
  const pastRequests = requests.filter(isPast);

  return (
    <div className="flex w-full max-w-2xl flex-col items-start gap-6 p-2">
      <div className="flex w-full items-center justify-between">
        <h3>Welcome back, {session.userName}.</h3>
        <AddActivityDialog />
      </div>

      <section className="flex w-full flex-col gap-3">
        <h2 className="text-lg font-semibold">Ongoing</h2>
        {ongoing.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recurring activities yet.</p>
        ) : (
          ongoing.map((activity) => <ActivityCard key={activity.id} activity={activity} />)
        )}
      </section>

      <section className="flex w-full flex-col gap-3">
        <h2 className="text-lg font-semibold">Requests</h2>
        {openRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open requests.</p>
        ) : (
          openRequests.map((activity) => <ActivityCard key={activity.id} activity={activity} />)
        )}

        {pastRequests.length > 0 && (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer">Past requests ({pastRequests.length})</summary>
            <div className="mt-3 flex flex-col gap-3">
              {pastRequests.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
};
