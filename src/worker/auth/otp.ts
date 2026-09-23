import { eq } from "drizzle-orm";

import { ensureChannel } from "../channels/channel.ts";
import { BASE_URL } from "../constants.ts";
import { createDb } from "../db/db.ts";
import { otpLoginsTable } from "../db/schema.ts";
import { ensureUser } from "../users/user.ts";
import { createSession } from "./session.ts";

const OTP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const OTP_TTL_MS = 5 * 60 * 1000;

const generateOtp = (length = 6): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => OTP_ALPHABET[byte % OTP_ALPHABET.length]).join("");
};

export const initiateLogin = async (
  env: Env,
  params: {
    userId: string;
    userName: string;
    channelId: string;
    channelName: string;
    responseUrl: string;
  },
) => {
  await ensureUser(env, { userId: params.userId, name: params.userName });
  await ensureChannel(env, {
    channelId: params.channelId,
    name: params.channelName,
    ownerIdIfNew: params.userId,
  });

  const db = createDb(env);

  const [otpLogin] = await db
    .insert(otpLoginsTable)
    .values({
      channelId: params.channelId,
      userId: params.userId,
      responseUrl: params.responseUrl,
      otp: generateOtp(),
      created: new Date().toISOString(),
      expires: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    })
    .returning();

  return otpLogin;
};

export type CompleteLoginResult =
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "success"; session: { id: string; expires: string } };

export const completeLogin = async (env: Env, otp: string): Promise<CompleteLoginResult> => {
  const db = createDb(env);

  console.log(`login attempt for otp ${otp}`);

  // Atomically claim and consume the row in one statement: concurrent requests for the
  // same otp can only ever have one of them see a row here, so it can't be redeemed twice.
  const [otpLogin] = await db.delete(otpLoginsTable).where(eq(otpLoginsTable.otp, otp)).returning();

  if (!otpLogin) {
    console.error(`no otp_logins row for otp ${otp}`);
    return { status: "invalid" };
  }

  if (otpLogin.expires < new Date().toISOString()) {
    console.error(`otp ${otp} expired at ${otpLogin.expires}`);
    return { status: "expired" };
  }

  const session = await createSession(env, {
    userId: otpLogin.userId,
    channelId: otpLogin.channelId,
  });

  console.log(`replacing ephemeral message via response_url ${otpLogin.responseUrl}`);

  const response = await fetch(otpLogin.responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replace_original: "true", text: `✅ Logged in — ${BASE_URL}` }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    console.error(
      `failed to replace ephemeral message for otp ${otp}: ${response.status} ${responseBody}`,
    );
  }

  return { status: "success", session };
};
