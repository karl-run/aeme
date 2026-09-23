import { createDb } from "../db/db.ts";
import { otpLoginsTable } from "../db/schema.ts";

const OTP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const OTP_TTL_MS = 5 * 60 * 1000;

function generateOtp(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => OTP_ALPHABET[byte % OTP_ALPHABET.length]).join("");
}

export async function initiateLogin(
  env: Env,
  params: { userId: string; channelId: string; responseUrl: string },
) {
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
}
