import { createDb } from "../db/db.ts";
import { sessionsTable } from "../db/schema.ts";

export const SESSION_COOKIE_NAME = "session_id";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(env: Env, params: { userId: string; channelId: string }) {
  const db = createDb(env);

  const [session] = await db
    .insert(sessionsTable)
    .values({
      id: crypto.randomUUID(),
      userId: params.userId,
      channelId: params.channelId,
      created: new Date().toISOString(),
      expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    })
    .returning();

  return session;
}
