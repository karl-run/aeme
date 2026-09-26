import { createDb } from "../db/db.ts";
import { activityAvailabilityTable, type ActivitySlot } from "../db/schema.ts";

export const upsertAvailability = async (
  env: Env,
  params: { activityId: string; userId: string; slots: ActivitySlot[] },
) => {
  const db = createDb(env);
  const now = new Date().toISOString();

  const [availability] = await db
    .insert(activityAvailabilityTable)
    .values({
      id: crypto.randomUUID(),
      activityId: params.activityId,
      userId: params.userId,
      slots: params.slots,
      created: now,
      updated: now,
    })
    .onConflictDoUpdate({
      target: [activityAvailabilityTable.activityId, activityAvailabilityTable.userId],
      set: { slots: params.slots, updated: now },
    })
    .returning();

  return availability;
};
