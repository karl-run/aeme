import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import * as z from "zod";

import {
  createActivity,
  getActivityById,
  listActivitiesForChannel,
} from "../activities/activity.ts";
import { upsertAvailability } from "../activities/availability.ts";
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

const createActivitySchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim(),
    endTime: z.iso.datetime({ local: true }).nullable(),
    persistent: z.boolean(),
    slotGranularity: z.enum(["day", "hourly"]),
    suggestedDates: z.array(z.iso.date()).min(1).nullable(),
  })
  .refine((data) => data.persistent || data.endTime !== null, {
    message: "End time is required unless the activity is persistent.",
    path: ["endTime"],
  })
  .refine((data) => !data.persistent || data.suggestedDates === null, {
    message: "Suggested dates are only supported for non-persistent activities.",
    path: ["suggestedDates"],
  });

const activitySlotSchema = z
  .object({
    date: z.iso.date(),
    from: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
  })
  .refine((slot) => !slot.from || !slot.to || slot.from < slot.to, {
    message: "from must be before to",
    path: ["to"],
  });

const upsertAvailabilitySchema = z.object({
  slots: z.array(activitySlotSchema),
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

    const { title, description, endTime, persistent, slotGranularity, suggestedDates } =
      c.req.valid("json");
    const activity = await createActivity(c.env, {
      channelId: session.channelId,
      title,
      description,
      endTime,
      persistent,
      slotGranularity,
      suggestedDates,
    });

    return c.json({ activity });
  })
  .get("/activities", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    const session = sessionId ? await getSessionMeta(c.env, sessionId) : null;
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const activities = await listActivitiesForChannel(c.env, session.channelId, session.userId);
    return c.json({ activities });
  })
  .put("/activities/:id/availability", zValidator("json", upsertAvailabilitySchema), async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    const session = sessionId ? await getSessionMeta(c.env, sessionId) : null;
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const activityId = c.req.param("id");
    const activity = await getActivityById(c.env, activityId);
    if (!activity || activity.channelId !== session.channelId) {
      return c.json({ error: "Not found" }, 404);
    }

    const { slots } = c.req.valid("json");

    if (activity.endTime && activity.endTime < new Date().toISOString()) {
      return c.json({ error: "This request has closed." }, 400);
    }

    if (activity.suggestedDates) {
      const allowedDates = new Set(activity.suggestedDates);
      const notSuggested = slots.some((slot) => !allowedDates.has(slot.date));
      if (notSuggested) {
        return c.json({ error: "Slot date is not one of the suggested dates." }, 400);
      }
    }

    const availability = await upsertAvailability(c.env, {
      activityId,
      userId: session.userId,
      slots,
    });

    return c.json({ availability });
  });

if (import.meta.env.DEV) {
  apiRouter.post("/dev/login", async (c) => {
    const { devLogin } = await import("../auth/dev-login.ts");
    const session = await devLogin(c.env);
    setSessionCookie(c, session);
    return c.json({ success: true });
  });
}
