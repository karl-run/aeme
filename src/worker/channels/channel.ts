import { createDb } from "../db/db.ts";
import { channelsTable } from "../db/schema.ts";

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
