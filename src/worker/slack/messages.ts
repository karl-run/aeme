type PostEphemeralResponse = {
  ok: boolean;
  error?: string;
};

export async function postEphemeral(
  env: Env,
  params: { channel: string; user: string; text: string },
): Promise<void> {
  const response = await fetch("https://slack.com/api/chat.postEphemeral", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const body = (await response.json()) as PostEphemeralResponse;

  if (!body.ok) {
    console.error(`chat.postEphemeral failed: ${body.error}`);
  }
}

type PostMessageResponse = {
  ok: boolean;
  ts?: string;
  error?: string;
};

/** Posts a message and returns its `ts`, so the caller can store it and
 * later edit the same message via `chat.update`. Returns null (and logs)
 * on failure rather than throwing — a Slack outage shouldn't block whatever
 * action triggered the post. */
export async function postMessage(
  env: Env,
  params: { channel: string; text: string; blocks?: unknown[] },
): Promise<{ ts: string } | null> {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const body = (await response.json()) as PostMessageResponse;

  if (!body.ok || !body.ts) {
    console.error(`chat.postMessage failed: ${body.error}`);
    return null;
  }

  return { ts: body.ts };
}
