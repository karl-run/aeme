import { eq, sql } from "drizzle-orm";

import { createDb, type Db } from "../db/db.ts";
import { usersTable } from "../db/schema.ts";
import { USER_COLOR_PALETTE } from "./colors.ts";

/** The palette color fewest users have, earliest in the palette on a tie —
 * so a run of sign-ups walks the palette in order and no two share a color
 * until it's used up. Evaluated in the insert itself, so batching
 * `ensureUserStatement` doesn't cost an extra round trip; on a conflict the
 * value is discarded and the existing color kept.
 *
 * SQLite evaluates it on every call, conflict or not, so each login counts
 * colors across the whole `users` table. Accepted while that table is
 * small; an index on `color` is the fix if it ever shows up in `bench`. */
const leastUsedColor = () => {
  const palette = sql.join(
    USER_COLOR_PALETTE.map((color, position) => sql`(${color}, ${position})`),
    sql`, `,
  );
  return sql<string>`(
    with palette(color, position) as (values ${palette})
    select palette.color from palette
    left join ${usersTable} on ${usersTable.color} = palette.color
    group by palette.color, palette.position
    order by count(${usersTable.userId}), palette.position
    limit 1
  )`;
};

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
      color: leastUsedColor(),
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

/** Assumes `color` is already a valid lowercase `#rrggbb` — the router
 * validates it, and the `users_color_hex` check rejects anything else. */
export const setUserColor = async (env: Env, userId: string, color: string) => {
  const db = createDb(env);
  await db.update(usersTable).set({ color }).where(eq(usersTable.userId, userId));
};

/** 128 bits of hex — the calendar feed's only credential, so it has to be
 * unguessable rather than merely unique. Matches the `users_calendar_token_hex`
 * check constraint's shape. */
const newCalendarToken = () =>
  [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const getCalendarToken = async (env: Env, userId: string): Promise<string | null> => {
  const db = createDb(env);

  const [user] = await db
    .select({ calendarToken: usersTable.calendarToken })
    .from(usersTable)
    .where(eq(usersTable.userId, userId));

  return user?.calendarToken ?? null;
};

/** Mints a calendar token for a user, replacing whatever they had. Both
 * "subscribe me" and "that link got out, revoke it" are this one operation:
 * the old value stops resolving the moment the new one is written, and any
 * calendar still polling the old URL starts getting a 404. */
export const issueCalendarToken = async (env: Env, userId: string): Promise<string> => {
  const db = createDb(env);
  const calendarToken = newCalendarToken();

  await db.update(usersTable).set({ calendarToken }).where(eq(usersTable.userId, userId));

  return calendarToken;
};

/** The subscriber behind a feed URL, or null if the token is unknown — which
 * includes every token that has since been rotated away. */
export const getUserIdByCalendarToken = async (
  env: Env,
  calendarToken: string,
): Promise<string | null> => {
  const db = createDb(env);

  const [user] = await db
    .select({ userId: usersTable.userId })
    .from(usersTable)
    .where(eq(usersTable.calendarToken, calendarToken));

  return user?.userId ?? null;
};
