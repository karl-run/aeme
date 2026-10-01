import { and, eq } from "drizzle-orm";

import { createDb } from "../db/db.ts";
import { activityLocationsTable } from "../db/schema.ts";

export const listActivityLocations = async (env: Env, activityId: string) => {
  const db = createDb(env);

  return db
    .select({
      id: activityLocationsTable.id,
      name: activityLocationsTable.name,
      mapsUrl: activityLocationsTable.mapsUrl,
    })
    .from(activityLocationsTable)
    .where(
      and(
        eq(activityLocationsTable.activityId, activityId),
        eq(activityLocationsTable.archived, false),
      ),
    )
    .orderBy(activityLocationsTable.created);
};

export const getActivityLocationById = async (env: Env, id: string) => {
  const db = createDb(env);

  const [location] = await db
    .select()
    .from(activityLocationsTable)
    .where(eq(activityLocationsTable.id, id));

  return location ?? null;
};

/** Only the activity's creator may call this (enforced by the router), and
 * only for a persistent activity. A name already in use by a live location
 * on this activity conflicts with the partial unique index — the router
 * turns that into a 400. */
export const createActivityLocation = async (
  env: Env,
  params: { activityId: string; name: string; mapsUrl: string },
) => {
  const db = createDb(env);

  const [location] = await db
    .insert(activityLocationsTable)
    .values({
      id: crypto.randomUUID(),
      activityId: params.activityId,
      name: params.name,
      mapsUrl: params.mapsUrl,
      archived: false,
      created: new Date().toISOString(),
    })
    .returning();

  return location;
};

/** Retires a location rather than deleting the row: bookings that already
 * reference it keep resolving their place, it just stops being offered for
 * new ones. The unique index covers live rows only, so the freed name can be
 * used again. */
export const archiveActivityLocation = async (env: Env, id: string) => {
  const db = createDb(env);

  await db
    .update(activityLocationsTable)
    .set({ archived: true })
    .where(eq(activityLocationsTable.id, id));
};
