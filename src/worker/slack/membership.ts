type ConversationsInfoResponse = {
  ok: boolean;
  channel?: { is_member: boolean };
  error?: string;
};

export async function isChannelMember(env: Env, channelId: string): Promise<boolean> {
  const url = new URL("https://slack.com/api/conversations.info");
  url.searchParams.set("channel", channelId);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
  });

  const body = (await response.json()) as ConversationsInfoResponse;

  if (!body.ok) {
    console.error(`conversations.info failed: ${body.error}`);
    return false;
  }

  return body.channel?.is_member ?? false;
}
