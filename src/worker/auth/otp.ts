import { createDb } from "../db/db.ts";
import { otpLoginsTable } from "../db/schema.ts";

export async function initiateLogin(env: Env) {
  const db = createDb(env);

  const inserted = await db
    .insert(otpLoginsTable)
    .values({
      channelId: "test",
      userId: "aaa",
      otp: "1 2 3 4 5 6",
      created: new Date().toISOString(),
      expires: new Date().toISOString(),
    })
    .returning();

  console.log(inserted);
}
