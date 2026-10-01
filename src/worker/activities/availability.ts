import { createDb } from "../db/db.ts";
import { activityAvailabilityTable, type ActivitySlot } from "../db/schema.ts";
import { announceActivitySuggestion } from "./activity.ts";

export const upsertAvailability = async (
  env: Env,
  params: {
    activityId: string;
    userId: string;
    slots: ActivitySlot[];
    declined: boolean;
    plusOne: boolean;
  },
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
      declined: params.declined,
      plusOne: params.plusOne,
      created: now,
      updated: now,
    })
    .onConflictDoUpdate({
      target: [activityAvailabilityTable.activityId, activityAvailabilityTable.userId],
      set: {
        slots: params.slots,
        declined: params.declined,
        plusOne: params.plusOne,
        updated: now,
      },
    })
    .returning();

  // No-ops for a persistent activity — only one-off suggestions are
  // announced to Slack.
  await announceActivitySuggestion(env, params.activityId);

  return availability;
};
