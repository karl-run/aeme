import { createFileRoute } from "@tanstack/react-router";

import { useSessionQuery } from "../queries/session.ts";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const { data } = useSessionQuery();
  const session = data?.session;

  return (
    <div className="flex w-full max-w-md flex-col gap-3 p-2 md:px-6">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="text-sm text-muted-foreground">This page is a placeholder.</p>

      {session && (
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between border-t border-border py-2">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{session.userName}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-border py-2">
            <dt className="text-muted-foreground">Channel</dt>
            <dd>#{session.channelName}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
