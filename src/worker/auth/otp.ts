import { eq } from "drizzle-orm";

import { ensureChannelMemberStatement, ensureChannelStatement } from "../channels/channel.ts";
import { BASE_URL } from "../constants.ts";
import { createDb } from "../db/db.ts";
import { otpLoginsTable } from "../db/schema.ts";
import { postEphemeral } from "../slack/messages.ts";
import { ensureUserStatement } from "../users/user.ts";
import { createSession } from "./session.ts";

const OTP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const OTP_TTL_MS = 5 * 60 * 1000;

const generateOtp = (length = 6): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => OTP_ALPHABET[byte % OTP_ALPHABET.length]).join("");
};

const hashOtp = async (otp: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(otp));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const initiateLogin = async (
  env: Env,
  params: {
    userId: string;
    userName: string;
    channelId: string;
    channelName: string;
  },
) => {
  const db = createDb(env);
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);

  // One round trip rather than four. The slash command is on a 3-second
  // Slack budget and every statement here is a request to Turso, so they go
  // as a batch — which libsql runs in order inside a transaction, keeping the
  // foreign keys satisfied (channel needs its owner, membership needs both)
  // and rolling the lot back if any of them fails.
  const [, , , [otpLogin]] = await db.batch([
    ensureUserStatement(db, { userId: params.userId, name: params.userName }),
    ensureChannelStatement(db, {
      channelId: params.channelId,
      name: params.channelName,
      ownerIdIfNew: params.userId,
    }),
    ensureChannelMemberStatement(db, {
      channelId: params.channelId,
      userId: params.userId,
    }),
    db
      .insert(otpLoginsTable)
      .values({
        channelId: params.channelId,
        userId: params.userId,
        otpHash,
        created: new Date().toISOString(),
        expires: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      })
      .returning(),
  ]);

  return { ...otpLogin, otp };
};

export type CompleteLoginResult =
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "success"; session: { id: string; expires: string } };

export const completeLogin = async (env: Env, otp: string): Promise<CompleteLoginResult> => {
  const db = createDb(env);

  console.log("login attempt");

  const otpHash = await hashOtp(otp);

  // Atomically claim and consume the row in one statement: concurrent requests for the
  // same otp can only ever have one of them see a row here, so it can't be redeemed twice.
  const [otpLogin] = await db
    .delete(otpLoginsTable)
    .where(eq(otpLoginsTable.otpHash, otpHash))
    .returning();

  if (!otpLogin) {
    console.error("login attempt for unknown otp");
    return { status: "invalid" };
  }

  if (otpLogin.expires < new Date().toISOString()) {
    console.error(`otp for user ${otpLogin.userId} expired at ${otpLogin.expires}`);
    return { status: "expired" };
  }

  const session = await createSession(env, {
    userId: otpLogin.userId,
    channelId: otpLogin.channelId,
  });

  await postEphemeral(env, {
    channel: otpLogin.channelId,
    user: otpLogin.userId,
    text: `✅ Logged in — ${BASE_URL}`,
  });

  return { status: "success", session };
};
