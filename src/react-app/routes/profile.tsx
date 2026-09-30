import { createFileRoute } from "@tanstack/react-router";

import { Button } from "../components/ui/button.tsx";
import { useChannelQuery } from "../queries/channel.ts";
import { useAddChannelMemberMutation, useChannelMembersQuery } from "../queries/channelMembers.ts";
import { useSessionQuery } from "../queries/session.ts";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

const formatCreated = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

function Profile() {
  const { data } = useSessionQuery();
  const session = data?.session;

  const { data: channel } = useChannelQuery();
  const { data: localMembers } = useChannelMembersQuery();
  const addMember = useAddChannelMemberMutation();

  const localMemberIds = new Set((localMembers ?? []).map((member) => member.userId));

  return (
    <div className="flex w-full max-w-md flex-col gap-3 p-2 md:px-6">
      <h1 className="text-2xl font-semibold">Profile</h1>

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

          {channel && (
            <>
              <div className="flex items-center justify-between border-t border-border py-2">
                <dt className="text-muted-foreground">Visibility</dt>
                <dd>{channel.isPrivate ? "Private" : "Public"}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-border py-2">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatCreated(channel.created)}</dd>
              </div>
              {channel.topic && (
                <div className="flex items-center justify-between border-t border-border py-2">
                  <dt className="text-muted-foreground">Topic</dt>
                  <dd className="text-right">{channel.topic}</dd>
                </div>
              )}
              {channel.purpose && (
                <div className="flex items-center justify-between border-t border-border py-2">
                  <dt className="text-muted-foreground">Purpose</dt>
                  <dd className="text-right">{channel.purpose}</dd>
                </div>
              )}
            </>
          )}
        </dl>
      )}

      {channel && channel.members.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Members ({channel.members.length})
          </h2>
          <ul className="flex flex-col text-sm">
            {channel.members.map((member) => {
              const isLocal = localMemberIds.has(member.userId);
              const isAddingThis =
                addMember.isPending && addMember.variables?.userId === member.userId;

              return (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-2 border-t border-border py-2"
                >
                  <span>{member.name}</span>
                  {isLocal ? (
                    <span className="text-xs text-muted-foreground">Added</span>
                  ) : (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={isAddingThis}
                      onClick={() => addMember.mutate({ userId: member.userId })}
                    >
                      {isAddingThis ? "Adding…" : "Add"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
