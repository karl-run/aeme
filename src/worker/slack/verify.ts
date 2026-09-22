import type { Context, Next } from "hono";

const TIMESTAMP_TOLERANCE_SECONDS = 60 * 5;

async function computeSignature(secret: string, timestamp: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`v0:${timestamp}:${body}`),
  );
  const hex = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `v0=${hex}`;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// See: https://api.slack.com/authentication/verifying-requests-from-slack.
export async function verifySlackRequest(c: Context<{ Bindings: Env }>, next: Next) {
  if (!c.env.SLACK_SIGNING_SECRET) {
    console.error("SLACK_SIGNING_SECRET is not configured");
    return c.text("server misconfigured", 500);
  }

  const timestamp = c.req.header("x-slack-request-timestamp");
  const signature = c.req.header("x-slack-signature");

  if (!timestamp || !signature) {
    console.error("missing slack signature headers");
    return c.text("missing slack signature headers", 400);
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TIMESTAMP_TOLERANCE_SECONDS) {
    console.error("stale slack request");
    return c.text("stale slack request", 400);
  }

  const body = await c.req.raw.clone().text();
  const expected = await computeSignature(c.env.SLACK_SIGNING_SECRET, timestamp, body);

  if (!timingSafeEqual(expected, signature)) {
    console.error("invalid slack signature");
    return c.text("invalid slack signature", 401);
  }

  await next();
}
