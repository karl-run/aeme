import { eq } from "drizzle-orm";

import { createDb } from "../db/db.ts";
import { activityAvailabilityTable, type ActivitySlot } from "../db/schema.ts";
import { announceActivitySuggestion } from "./activity.ts";

const timeToMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Every cell a slot occupies — the date alone for a whole-day slot, or
 * `date|hour` per hour its range overlaps. Same keys as the client's
 * `keysForSlot`, so "full" means the same thing on both sides. */
const keysForSlot = (slot: ActivitySlot): string[] => {
  if (!slot.from || !slot.to) return [slot.date];

  const startHour = Math.floor(timeToMinutes(slot.from) / 60);
  const endHourExclusive = Math.ceil(timeToMinutes(slot.to) / 60);
  return Array.from(
    { length: Math.max(0, endHourExclusive - startHour) },
    (_, i) => `${slot.date}|${startHour + i}`,
  );
};

/** Whether saving this answer would push any day/hour past the activity's
 * max. Only cells the user is *joining* are checked — a new pick, or one
 * they're now bringing a +1 to — so lowering the max later never locks
 * anyone out of a spot they already hold. Each person counts once, plus one
 * for a guest, the same headcount the dashboard shows. */
export const wouldExceedMax = async (
  env: Env,
  params: {
    activityId: string;
    userId: string;
    maxMemberCount: number;
    slots: ActivitySlot[];
    plusOne: boolean;
  },
) => {
  const db = createDb(env);

  const rows = await db
    .select({
      userId: activityAvailabilityTable.userId,
      slots: activityAvailabilityTable.slots,
      plusOne: activityAvailabilityTable.plusOne,
    })
    .from(activityAvailabilityTable)
    .where(eq(activityAvailabilityTable.activityId, params.activityId));

  const own = rows.find((row) => row.userId === params.userId);
  const ownKeys = new Set(own?.slots.flatMap(keysForSlot) ?? []);
  const addingGuest = params.plusOne && !own?.plusOne;

  const taken = new Map<string, number>();
  for (const row of rows) {
    if (row.userId === params.userId) continue;
    for (const key of new Set(row.slots.flatMap(keysForSlot))) {
      taken.set(key, (taken.get(key) ?? 0) + (row.plusOne ? 2 : 1));
    }
  }

  const seats = params.plusOne ? 2 : 1;
  return [...new Set(params.slots.flatMap(keysForSlot))].some(
    (key) =>
      (!ownKeys.has(key) || addingGuest) && (taken.get(key) ?? 0) + seats > params.maxMemberCount,
  );
};

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
