import { ensureChannel } from "../channels/channel.ts";
import { ensureUser } from "../users/user.ts";
import { createSession } from "./session.ts";

const DEV_CHANNEL_ID = "C0C3KKW19MK";

export const DEV_USERS = {
  a: { userId: "dev-user", name: "Dev User A" },
  b: { userId: "dev-user-b", name: "Dev User B" },
  c: { userId: "dev-user-c", name: "Dev User C" },
} as const;

export type DevUserKey = keyof typeof DEV_USERS;

export const devLogin = async (env: Env, userKey: DevUserKey = "a") => {
  const user = DEV_USERS[userKey];

  await ensureUser(env, { userId: user.userId, name: user.name });
  await ensureChannel(env, {
    channelId: DEV_CHANNEL_ID,
    name: "dev",
    ownerIdIfNew: user.userId,
  });

  return createSession(env, { userId: user.userId, channelId: DEV_CHANNEL_ID });
};
