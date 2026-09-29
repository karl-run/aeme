import { eq } from "drizzle-orm";

import { createDb } from "../db/db.ts";
import { channelsTable, sessionsTable, usersTable } from "../db/schema.ts";

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

/** Users "known" to a channel, i.e. anyone who has ever logged into æme from
 * it — there's no separate Slack-synced membership list. */
export const listChannelMembers = async (env: Env, channelId: string) => {
  const db = createDb(env);

  const rows = await db
    .selectDistinct({ userId: usersTable.userId, name: usersTable.name })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.userId, sessionsTable.userId))
    .where(eq(sessionsTable.channelId, channelId))
    .orderBy(usersTable.name);

  return rows;
};
