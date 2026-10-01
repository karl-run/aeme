import { eq } from "drizzle-orm";

import { createDb, type Db } from "../db/db.ts";
import { usersTable } from "../db/schema.ts";

/** The statement on its own, so callers that need several of these can send
 * them as one batch instead of a round trip each (see `initiateLogin`).
 *
 * Updates the name rather than leaving the first one ever seen in place: a
 * Slack rename should propagate, and callers must therefore pass the display
 * name, never the `user_name` handle. */
export const ensureUserStatement = (db: Db, params: { userId: string; name: string }) =>
  db
    .insert(usersTable)
    .values({
      userId: params.userId,
      name: params.name,
      created: new Date().toISOString(),
    })
    .onConflictDoUpdate({ target: usersTable.userId, set: { name: params.name } });

export const ensureUser = async (env: Env, params: { userId: string; name: string }) => {
  await ensureUserStatement(createDb(env), params);
};

export const getUserName = async (env: Env, userId: string): Promise<string | null> => {
  const db = createDb(env);

  const [user] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.userId, userId));

  return user?.name ?? null;
};
