import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { initiateLogin } from "../auth/otp.ts";
import { LOGIN_URL } from "../constants.ts";
import { isChannelMember } from "./membership.ts";
import { postEphemeral } from "./messages.ts";
import { slashCommandSchema } from "./schema.ts";
import { verifySlackRequest } from "./verify.ts";

const app = new Hono<{ Bindings: Env }>().post(
  "/aeme",
  verifySlackRequest,
  zValidator("form", slashCommandSchema),
  async (c) => {
    const command = c.req.valid("form");

    if (!(await isChannelMember(c.env, command.channel_id))) {
      return c.json({
        response_type: "ephemeral",
        text: "æme needs to be added to this channel first — add it under channel settings > Integrations, then try again.",
      });
    }

    if (command.text === "") {
      const otpLogin = await initiateLogin(c.env, {
        userId: command.user_id,
        userName: command.user_name,
        channelId: command.channel_id,
        channelName: command.channel_name,
      });

      await postEphemeral(c.env, {
        channel: command.channel_id,
        user: command.user_id,
        text: `Log in at ${LOGIN_URL} with the code: ${otpLogin.otp}`,
      });

      return c.body(null, 200);
    }

    return c.json({ response_type: "ephemeral", text: `received: ${command.text}` });
  },
);

export const slackRouter = app;
