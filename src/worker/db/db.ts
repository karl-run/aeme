import { drizzle } from "drizzle-orm/libsql";

export function createDb(env: Env) {
  return drizzle({
    connection: {
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    },
  });
}
