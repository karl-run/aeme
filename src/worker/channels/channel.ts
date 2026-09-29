import { eq } from "drizzle-orm";

import { createDb } from "../db/db.ts";
import { channelMembersTable, channelsTable, usersTable } from "../db/schema.ts";

export const ensureChannel = async (
  env: Env,
  params: { channelId: string; name: string; ownerIdIfNew: string },
) => {
  const db = createDb(env);

  await db
    .insert(channelsTable)
    .values({
      channelId: params.channelId,
      name: params.name,
      owner: params.ownerIdIfNew,
      created: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: channelsTable.channelId });
};

/** Records that a user belongs to a channel — a user can be a member of
 * multiple channels. Call this whenever a user is confirmed to be acting
 * from a given channel (e.g. running the slash command there). */
export const ensureChannelMember = async (
  env: Env,
  params: { channelId: string; userId: string },
) => {
  const db = createDb(env);

  await db
    .insert(channelMembersTable)
    .values({
      id: crypto.randomUUID(),
      channelId: params.channelId,
      userId: params.userId,
      created: new Date().toISOString(),
    })
    .onConflictDoNothing({
      target: [channelMembersTable.channelId, channelMembersTable.userId],
    });
};

export const listChannelMembers = async (env: Env, channelId: string) => {
  const db = createDb(env);

  const rows = await db
    .select({ userId: usersTable.userId, name: usersTable.name })
    .from(channelMembersTable)
    .innerJoin(usersTable, eq(usersTable.userId, channelMembersTable.userId))
    .where(eq(channelMembersTable.channelId, channelId))
    .orderBy(usersTable.name);

  return rows;
};
