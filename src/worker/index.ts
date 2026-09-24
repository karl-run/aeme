import { Hono } from "hono";

import { cleanupExpired } from "./auth/cleanup.ts";
import { apiRouter } from "./rpc/router.ts";
import { slackRouter } from "./slack/router.ts";

const app = new Hono();

app.route("/api", apiRouter);
app.route("/slack", slackRouter);

export default {
  fetch: app.fetch,
  scheduled: async (_event, env) => {
    await cleanupExpired(env);
  },
} satisfies ExportedHandler<Env>;
