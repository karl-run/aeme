import { drizzle } from "drizzle-orm/libsql";

export function createDb(env: Env) {
  return drizzle({
    connection: {
      url: env.DATABASE_URL,
      authToken: env.DATABASE_AUTH_TOKEN,
    },
  });
}
