import { Hono } from "hono";

import { apiRouter } from "./rpc/router.ts";
import { slackRouter } from "./slack/router.ts";

const app = new Hono();

app.route("/api", apiRouter);
app.route("/slack", slackRouter);

export default app;
