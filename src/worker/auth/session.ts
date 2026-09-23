import { eq } from "drizzle-orm";

import { createDb } from "../db/db.ts";
import { channelsTable, sessionsTable } from "../db/schema.ts";

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

export type SessionMeta = {
  userId: string;
  channelId: string;
  channelName: string;
  expires: string;
};

export async function getSessionMeta(env: Env, sessionId: string): Promise<SessionMeta | null> {
  const db = createDb(env);

  const [session] = await db
    .select({
      userId: sessionsTable.userId,
      channelId: sessionsTable.channelId,
      channelName: channelsTable.name,
      expires: sessionsTable.expires,
    })
    .from(sessionsTable)
    .innerJoin(channelsTable, eq(sessionsTable.channelId, channelsTable.channelId))
    .where(eq(sessionsTable.id, sessionId));

  if (!session) return null;
  if (session.expires < new Date().toISOString()) return null;

  return session;
}
