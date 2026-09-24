import { createDb } from "../db/db.ts";
import { activitiesTable } from "../db/schema.ts";

export const createActivity = async (
  env: Env,
  params: {
    channelId: string;
    title: string;
    description: string;
    endTime: string | null;
    persistent: boolean;
  },
) => {
  const db = createDb(env);

  const [activity] = await db
    .insert(activitiesTable)
    .values({
      id: crypto.randomUUID(),
      channelId: params.channelId,
      title: params.title,
      description: params.description,
      endTime: params.persistent ? null : params.endTime,
      persistent: params.persistent,
      archived: false,
      created: new Date().toISOString(),
    })
    .returning();

  return activity;
};
