import { createDb } from "../db/db.ts";
import { otpLoginsTable } from "../db/schema.ts";

const OTP_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateOtp(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => OTP_ALPHABET[byte % OTP_ALPHABET.length]).join("");
}

export async function initiateLogin(env: Env) {
  const db = createDb(env);

  const inserted = await db
    .insert(otpLoginsTable)
    .values({
      channelId: "test",
      userId: "aaa",
      otp: generateOtp(),
      created: new Date().toISOString(),
      expires: new Date().toISOString(),
    })
    .returning();

  console.log(inserted);
}
