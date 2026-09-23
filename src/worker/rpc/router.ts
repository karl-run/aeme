import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import * as z from "zod";

import { completeLogin } from "../auth/otp.ts";
import { getSessionMeta, SESSION_COOKIE_NAME } from "../auth/session.ts";

const loginSchema = z.object({
  otp: z
    .string()
    .length(6)
    .transform((otp) => otp.toUpperCase()),
});

export const apiRouter = new Hono<{ Bindings: Env }>()
  .get("/session", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (!sessionId) return c.json({ session: null });

    const session = await getSessionMeta(c.env, sessionId);
    return c.json({ session });
  })
  .post("/login", zValidator("form", loginSchema), async (c) => {
    const { otp } = c.req.valid("form");
    const result = await completeLogin(c.env, otp);

    switch (result.status) {
      case "invalid":
      case "expired":
        return c.json({ success: false }, 400);
      case "notify_failed":
        return c.json({ success: false }, 502);
      case "success":
        setCookie(c, SESSION_COOKIE_NAME, result.session.id, {
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
          path: "/",
          expires: new Date(result.session.expires),
        });
        return c.json({ success: true });
    }
  });
