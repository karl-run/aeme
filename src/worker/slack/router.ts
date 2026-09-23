import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { initiateLogin } from "../auth/otp.ts";
import { LOGIN_URL } from "../constants.ts";
import { slashCommandSchema } from "./schema.ts";
import { verifySlackRequest } from "./verify.ts";

const app = new Hono<{ Bindings: Env }>().post(
  "/aeme",
  verifySlackRequest,
  zValidator("form", slashCommandSchema),
  async (c) => {
    const command = c.req.valid("form");

    if (command.text === "") {
      const otpLogin = await initiateLogin(c.env, {
        userId: command.user_id,
        channelId: command.channel_id,
        responseUrl: command.response_url,
      });

      return c.json({
        response_type: "ephemeral",
        text: `Log in at ${LOGIN_URL} with the code: ${otpLogin.otp}`,
      });
    }

    return c.json({ response_type: "ephemeral", text: `received: ${command.text}` });
  },
);

export const slackRouter = app;
