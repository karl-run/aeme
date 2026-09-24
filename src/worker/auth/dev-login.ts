import { ensureChannel } from "../channels/channel.ts";
import { ensureUser } from "../users/user.ts";
import { createSession } from "./session.ts";

const DEV_USER_ID = "dev-user";
const DEV_CHANNEL_ID = "dev-channel";

export const devLogin = async (env: Env) => {
  await ensureUser(env, { userId: DEV_USER_ID, name: "Dev User" });
  await ensureChannel(env, {
    channelId: DEV_CHANNEL_ID,
    name: "dev",
    ownerIdIfNew: DEV_USER_ID,
  });

  return createSession(env, { userId: DEV_USER_ID, channelId: DEV_CHANNEL_ID });
};
