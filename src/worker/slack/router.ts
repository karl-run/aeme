import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { initiateLogin } from "../auth/otp.ts";
import { LOGIN_URL } from "../constants.ts";
import { getMemberName } from "./channels.ts";
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

    // Both are read-only Slack lookups, so they overlap for free. The payload
    // carries `user_name` — the lowercase dotted handle — but every other
    // surface in æme shows a display name, so resolve that instead and let
    // the handle be the fallback if the lookup fails.
    const [isMember, member] = await Promise.all([
      isChannelMember(c.env, command.channel_id),
      getMemberName(c.env, command.user_id),
    ]);

    if (!isMember) {
      return c.json({
        response_type: "ephemeral",
        text: "æme needs to be added to this channel first — add it under channel settings > Integrations, then try again.",
      });
    }

    if (command.text === "") {
      const otpLogin = await initiateLogin(c.env, {
        userId: command.user_id,
        userName: member?.name ?? command.user_name,
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
