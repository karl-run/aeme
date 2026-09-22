import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { initiateLogin } from "../auth/otp.ts";
import { slashCommandSchema } from "./schema.ts";
import { verifySlackRequest } from "./verify.ts";

const app = new Hono<{ Bindings: Env }>()
  .use("*", verifySlackRequest)
  .post("/aeme", zValidator("form", slashCommandSchema), async (c) => {
    const command = c.req.valid("form");

    // Debug
    await initiateLogin(c.env);

    return c.json({ response_type: "ephemeral", text: `received: ${command.text}` });
  });

export const slackRouter = app;
