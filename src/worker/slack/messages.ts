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
  params: {
    channel: string;
    text: string;
    blocks?: unknown[];
    unfurl_links?: boolean;
    unfurl_media?: boolean;
    /** Parent message `ts` to post this as a threaded reply to. */
    thread_ts?: string;
    /** With `thread_ts`: also shows the reply in the main channel feed. */
    reply_broadcast?: boolean;
  },
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

type UpdateMessageResponse = {
  ok: boolean;
  error?: string;
};

/** Edits a previously-posted message in place. Returns false (and logs) on
 * failure rather than throwing — the caller decides whether to fall back to
 * posting a fresh message. */
export async function updateMessage(
  env: Env,
  params: {
    channel: string;
    ts: string;
    text: string;
    blocks?: unknown[];
    unfurl_links?: boolean;
    unfurl_media?: boolean;
  },
): Promise<boolean> {
  const response = await fetch("https://slack.com/api/chat.update", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const body = (await response.json()) as UpdateMessageResponse;

  if (!body.ok) {
    console.error(`chat.update failed: ${body.error}`);
    return false;
  }

  return true;
}

/** Edits a message in place (via `chat.update`) if `existingTs` is given,
 * falling back to a fresh post if there's no existing message or the edit
 * fails (e.g. the original was deleted). Returns the `ts` the caller should
 * persist for next time, or null if nothing needs to change (an edit
 * succeeded, so the already-stored ts is still valid). */
export async function postOrUpdateMessage(
  env: Env,
  params: {
    channel: string;
    existingTs: string | null;
    text: string;
    blocks?: unknown[];
    thread_ts?: string;
    reply_broadcast?: boolean;
  },
): Promise<string | null> {
  if (params.existingTs) {
    const updated = await updateMessage(env, {
      channel: params.channel,
      ts: params.existingTs,
      text: params.text,
      blocks: params.blocks,
      unfurl_links: false,
      unfurl_media: false,
    });
    if (updated) return null;
  }

  const posted = await postMessage(env, {
    channel: params.channel,
    text: params.text,
    blocks: params.blocks,
    unfurl_links: false,
    unfurl_media: false,
    thread_ts: params.thread_ts,
    reply_broadcast: params.reply_broadcast,
  });

  return posted?.ts ?? null;
}
