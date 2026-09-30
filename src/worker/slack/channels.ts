type ConversationsInfoResponse = {
  ok: boolean;
  channel?: {
    name: string;
    is_private: boolean;
    created: number;
    topic?: { value: string };
    purpose?: { value: string };
  };
  error?: string;
};

export type ChannelInfo = {
  name: string;
  isPrivate: boolean;
  created: string;
  topic: string | null;
  purpose: string | null;
};

export async function getChannelInfo(env: Env, channelId: string): Promise<ChannelInfo | null> {
  const url = new URL("https://slack.com/api/conversations.info");
  url.searchParams.set("channel", channelId);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
  });

  const body = (await response.json()) as ConversationsInfoResponse;

  if (!body.ok || !body.channel) {
    console.error(`conversations.info failed: ${body.error}`);
    return null;
  }

  return {
    name: body.channel.name,
    isPrivate: body.channel.is_private,
    created: new Date(body.channel.created * 1000).toISOString(),
    topic: body.channel.topic?.value || null,
    purpose: body.channel.purpose?.value || null,
  };
}

type ConversationsMembersResponse = {
  ok: boolean;
  members?: string[];
  error?: string;
};

type UsersInfoResponse = {
  ok: boolean;
  user?: {
    name: string;
    real_name?: string;
    is_bot: boolean;
    deleted: boolean;
    profile?: { display_name?: string };
  };
  error?: string;
};

export type ChannelMember = {
  userId: string;
  name: string;
};

const getMemberName = async (env: Env, userId: string): Promise<ChannelMember | null> => {
  const url = new URL("https://slack.com/api/users.info");
  url.searchParams.set("user", userId);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
  });
  const body = (await response.json()) as UsersInfoResponse;

  if (!body.ok || !body.user) {
    console.error(`users.info failed: ${body.error}`);
    return null;
  }
  if (body.user.is_bot || body.user.deleted) return null;

  const name = body.user.profile?.display_name || body.user.real_name || body.user.name;
  return { userId, name };
};

/** Real, Slack-synced channel roster (as opposed to `listChannelMembers` in
 * `channels/channel.ts`, which only knows about people who've personally
 * logged into æme) — excludes bots and deactivated users. */
export async function getChannelMembers(env: Env, channelId: string): Promise<ChannelMember[]> {
  const url = new URL("https://slack.com/api/conversations.members");
  url.searchParams.set("channel", channelId);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
  });
  const body = (await response.json()) as ConversationsMembersResponse;

  if (!body.ok || !body.members) {
    console.error(`conversations.members failed: ${body.error}`);
    return [];
  }

  const members = await Promise.all(body.members.map((userId) => getMemberName(env, userId)));
  return members.filter((member) => member !== null).sort((a, b) => a.name.localeCompare(b.name));
}
