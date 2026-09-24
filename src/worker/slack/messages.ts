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
