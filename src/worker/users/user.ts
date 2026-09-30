import { createDb } from "../db/db.ts";
import { usersTable } from "../db/schema.ts";

export const ensureUser = async (env: Env, params: { userId: string; name: string }) => {
  const db = createDb(env);

  await db
    .insert(usersTable)
    .values({
      userId: params.userId,
      name: params.name,
      created: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: usersTable.userId });
};
