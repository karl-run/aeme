import { eq } from "drizzle-orm";

import { createDb, type Db } from "../db/db.ts";
import { channelMembersTable, channelsTable, usersTable } from "../db/schema.ts";
import { ensureUser } from "../users/user.ts";

/** Statement-only form, for batching — see `ensureUserStatement`. */
export const ensureChannelStatement = (
  db: Db,
  params: { channelId: string; name: string; ownerIdIfNew: string },
) =>
  db
    .insert(channelsTable)
    .values({
      channelId: params.channelId,
      name: params.name,
      owner: params.ownerIdIfNew,
      created: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: channelsTable.channelId });

export const ensureChannel = async (
  env: Env,
  params: { channelId: string; name: string; ownerIdIfNew: string },
) => {
  await ensureChannelStatement(createDb(env), params);
};

/** Records that a user belongs to a channel — a user can be a member of
 * multiple channels. Call this whenever a user is confirmed to be acting
 * from a given channel (e.g. running the slash command there). */
/** Statement-only form, for batching — see `ensureUserStatement`. */
export const ensureChannelMemberStatement = (
  db: Db,
  params: { channelId: string; userId: string },
) =>
  db
    .insert(channelMembersTable)
    .values({
      id: crypto.randomUUID(),
      channelId: params.channelId,
      userId: params.userId,
      joined: new Date().toISOString(),
    })
    .onConflictDoNothing({
      target: [channelMembersTable.channelId, channelMembersTable.userId],
    });

export const ensureChannelMember = async (
  env: Env,
  params: { channelId: string; userId: string },
) => {
  await ensureChannelMemberStatement(createDb(env), params);
};

/** Pre-loads a Slack member (from the live roster, see `getChannelMembers`)
 * into the local DB before they've ever logged into æme, so they're
 * immediately selectable as a channel member (e.g. as a booking attendee).
 * If they do log in later, `ensureUser`/`ensureChannelMember` just no-op on
 * the rows this already created. */
export const addChannelMember = async (
  env: Env,
  params: { channelId: string; userId: string; name: string },
) => {
  await ensureUser(env, { userId: params.userId, name: params.name });
  await ensureChannelMember(env, { channelId: params.channelId, userId: params.userId });
};

/** Channels a user can switch a session into — every channel they've ever
 * interacted with æme from, or been pre-loaded into via the profile page's
 * "Add" action. */
export const listChannelsForUser = async (env: Env, userId: string) => {
  const db = createDb(env);

  const rows = await db
    .select({ channelId: channelsTable.channelId, name: channelsTable.name })
    .from(channelMembersTable)
    .innerJoin(channelsTable, eq(channelsTable.channelId, channelMembersTable.channelId))
    .where(eq(channelMembersTable.userId, userId))
    .orderBy(channelsTable.name);

  return rows;
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
