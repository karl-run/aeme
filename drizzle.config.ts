import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".dev.vars" });

export default defineConfig({
  out: "./drizzle",
  schema: "./src/worker/db/schema.ts",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
