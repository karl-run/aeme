import { and, eq } from "drizzle-orm";

import { createDb } from "../db/db.ts";
import { activitiesTable, activityAvailabilityTable } from "../db/schema.ts";

export const createActivity = async (
  env: Env,
  params: {
    channelId: string;
    title: string;
    description: string;
    endTime: string | null;
    persistent: boolean;
    slotGranularity: "day" | "hourly";
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
      slotGranularity: params.slotGranularity,
      archived: false,
      created: new Date().toISOString(),
    })
    .returning();

  return activity;
};

export const getActivityById = async (env: Env, id: string) => {
  const db = createDb(env);

  const [activity] = await db.select().from(activitiesTable).where(eq(activitiesTable.id, id));

  return activity ?? null;
};

export const listActivitiesForChannel = async (env: Env, channelId: string, userId: string) => {
  const db = createDb(env);

  const rows = await db
    .select({
      id: activitiesTable.id,
      title: activitiesTable.title,
      description: activitiesTable.description,
      endTime: activitiesTable.endTime,
      persistent: activitiesTable.persistent,
      slotGranularity: activitiesTable.slotGranularity,
      created: activitiesTable.created,
      slots: activityAvailabilityTable.slots,
    })
    .from(activitiesTable)
    .leftJoin(
      activityAvailabilityTable,
      and(
        eq(activityAvailabilityTable.activityId, activitiesTable.id),
        eq(activityAvailabilityTable.userId, userId),
      ),
    )
    .where(and(eq(activitiesTable.channelId, channelId), eq(activitiesTable.archived, false)))
    .orderBy(activitiesTable.created);

  return rows.map((row) => ({ ...row, slots: row.slots ?? [] }));
};
