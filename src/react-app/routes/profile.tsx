import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PageContainer } from "../components/PageContainer.tsx";
import { Section } from "../components/Section.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { Skeleton } from "../components/ui/skeleton.tsx";
import { useChannelQuery } from "../queries/channel.ts";
import { useAddChannelMemberMutation, useChannelMembersQuery } from "../queries/channelMembers.ts";
import { useSessionQuery } from "../queries/session.ts";

const formatCreated = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

const DetailRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 border-t border-border py-2 text-sm first:border-t-0 first:pt-0">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-right">{children}</dd>
  </div>
);

const DetailRowSkeleton = ({ width }: { width: string }) => (
  <div className="flex items-center justify-between gap-4 border-t border-border py-2 first:border-t-0 first:pt-0">
    <Skeleton className="h-4 w-20" />
    <Skeleton className={`h-4 ${width}`} />
  </div>
);

const MemberRowSkeleton = () => (
  <li className="flex items-center justify-between gap-2 border-t border-border py-2 first:border-t-0 first:pt-0">
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-6 w-12 rounded-full" />
  </li>
);

const Profile = () => {
  const session = useSessionQuery();
  const channel = useChannelQuery();
  const localMembers = useChannelMembersQuery();
  const addMember = useAddChannelMemberMutation();

  const localMemberIds = new Set((localMembers.data ?? []).map((member) => member.userId));
  const currentSession = session.data?.session;

  if (!session.isPending && !currentSession) {
    return (
      <PageContainer className="flex max-w-3xl flex-col items-start gap-3 p-2 md:px-6">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          You're not logged in.{" "}
          <Link to="/login" className="underline">
            Log in
          </Link>{" "}
          to see your channel.
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex max-w-3xl flex-col items-start gap-4 p-2 pb-10 md:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Who you're signed in as, and the channel you're looking at.
        </p>
      </header>

      <Section title="You">
        <dl className="flex flex-col">
          {session.isPending ? (
            <>
              <DetailRowSkeleton width="w-28" />
              <DetailRowSkeleton width="w-20" />
            </>
          ) : (
            <>
              <DetailRow label="Name">{currentSession?.userName}</DetailRow>
              <DetailRow label="Channel">#{currentSession?.channelName}</DetailRow>
            </>
          )}
        </dl>
      </Section>

      <Section
        title="Channel"
        description="Pulled live from Slack."
        action={
          channel.isPending ? (
            <Skeleton className="h-5 w-16 rounded-full" />
          ) : channel.data ? (
            <Badge>{channel.data.isPrivate ? "Private" : "Public"}</Badge>
          ) : null
        }
      >
        {channel.isPending ? (
          <dl className="flex flex-col">
            <DetailRowSkeleton width="w-32" />
            <DetailRowSkeleton width="w-44" />
            <DetailRowSkeleton width="w-36" />
          </dl>
        ) : channel.isError || !channel.data ? (
          <p className="text-sm text-muted-foreground">Couldn't load channel details from Slack.</p>
        ) : (
          <dl className="flex flex-col">
            <DetailRow label="Created">{formatCreated(channel.data.created)}</DetailRow>
            {channel.data.topic && <DetailRow label="Topic">{channel.data.topic}</DetailRow>}
            {channel.data.purpose && <DetailRow label="Purpose">{channel.data.purpose}</DetailRow>}
          </dl>
        )}
      </Section>

      <Section
        title={channel.data ? `Members (${channel.data.members.length})` : "Members"}
        description="Add someone to make them pickable as an attendee before they've ever logged in."
      >
        {channel.isPending ? (
          <ul className="flex flex-col">
            {Array.from({ length: 4 }, (_, i) => (
              <MemberRowSkeleton key={i} />
            ))}
          </ul>
        ) : channel.isError || !channel.data ? (
          <p className="text-sm text-muted-foreground">Couldn't load the member list.</p>
        ) : channel.data.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members found in this channel.</p>
        ) : (
          <ul className="flex flex-col">
            {channel.data.members.map((member) => {
              const isLocal = localMemberIds.has(member.userId);
              const isAddingThis =
                addMember.isPending && addMember.variables?.userId === member.userId;

              return (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-t-0 first:pt-0"
                >
                  <span className="min-w-0 truncate">{member.name}</span>
                  {localMembers.isPending ? (
                    <Skeleton className="h-6 w-12 rounded-full" />
                  ) : isLocal ? (
                    <Badge variant="outline">Added</Badge>
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
        )}

        {addMember.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            Failed to add that member.
          </p>
        )}
      </Section>
    </PageContainer>
  );
};

export const Route = createFileRoute("/profile")({
  component: Profile,
});
