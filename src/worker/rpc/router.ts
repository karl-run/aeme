import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import * as z from "zod";

import { createActivity } from "../activities/activity.ts";
import { completeLogin } from "../auth/otp.ts";
import {
  deleteSession,
  getSessionMeta,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "../auth/session.ts";

const loginSchema = z.object({
  otp: z
    .string()
    .length(6)
    .transform((otp) => otp.toUpperCase()),
});

const createActivitySchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim(),
  endTime: z.iso.datetime({ local: true }).nullable(),
  persistent: z.boolean(),
});

export const apiRouter = new Hono<{ Bindings: Env }>()
  .get("/session", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (!sessionId) return c.json({ session: null });

    const session = await getSessionMeta(c.env, sessionId);
    return c.json({ session });
  })
  .delete("/session", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (sessionId) await deleteSession(c.env, sessionId);

    deleteCookie(c, SESSION_COOKIE_NAME);
    return c.json({ success: true });
  })
  .post("/login", zValidator("form", loginSchema), async (c) => {
    const { otp } = c.req.valid("form");
    const result = await completeLogin(c.env, otp);

    switch (result.status) {
      case "invalid":
      case "expired":
        return c.json({ success: false }, 400);
      case "success":
        setSessionCookie(c, result.session);
        return c.json({ success: true });
    }
  })
  .post("/activities", zValidator("json", createActivitySchema), async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    const session = sessionId ? await getSessionMeta(c.env, sessionId) : null;
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const { title, description, endTime, persistent } = c.req.valid("json");
    const activity = await createActivity(c.env, {
      channelId: session.channelId,
      title,
      description,
      endTime,
      persistent,
    });

    return c.json({ activity });
  });

if (import.meta.env.DEV) {
  apiRouter.post("/dev/login", async (c) => {
    const { devLogin } = await import("../auth/dev-login.ts");
    const session = await devLogin(c.env);
    setSessionCookie(c, session);
    return c.json({ success: true });
  });
}
