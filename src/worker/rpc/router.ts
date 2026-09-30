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
import { createBooking, getBookingById, updateBooking } from "../activities/booking.ts";
import { buildBookingIcs } from "../activities/ics.ts";
import { completeLogin } from "../auth/otp.ts";
import {
  deleteSession,
  getSessionMeta,
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "../auth/session.ts";
import { addChannelMember, listChannelMembers } from "../channels/channel.ts";
import { getChannelInfo, getChannelMembers } from "../slack/channels.ts";

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

const addChannelMemberSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1),
});

const createBookingSchema = z
  .object({
    date: z.iso.date(),
    from: z.string().regex(/^\d{2}:\d{2}$/),
    to: z.string().regex(/^\d{2}:\d{2}$/),
    description: z.string().trim(),
    location: z.string().trim(),
    attendeeUserIds: z.array(z.string()),
    guestNames: z.array(z.string().trim().min(1)),
  })
  .refine((data) => data.from < data.to, {
    message: "from must be before to",
    path: ["to"],
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
  })
  .get("/channels/members", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    const session = sessionId ? await getSessionMeta(c.env, sessionId) : null;
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const members = await listChannelMembers(c.env, session.channelId);
    return c.json({ members });
  })
  .get("/channel", async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    const session = sessionId ? await getSessionMeta(c.env, sessionId) : null;
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const [channel, members] = await Promise.all([
      getChannelInfo(c.env, session.channelId),
      getChannelMembers(c.env, session.channelId),
    ]);

    return c.json({ channel: channel ? { ...channel, members } : null });
  })
  .post("/channel/members", zValidator("json", addChannelMemberSchema), async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    const session = sessionId ? await getSessionMeta(c.env, sessionId) : null;
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const { userId, name } = c.req.valid("json");
    await addChannelMember(c.env, { channelId: session.channelId, userId, name });

    return c.json({ success: true });
  })
  .post("/activities/:id/bookings", zValidator("json", createBookingSchema), async (c) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    const session = sessionId ? await getSessionMeta(c.env, sessionId) : null;
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    const activityId = c.req.param("id");
    const activity = await getActivityById(c.env, activityId);
    if (!activity || activity.channelId !== session.channelId) {
      return c.json({ error: "Not found" }, 404);
    }

    const { date, from, to, description, location, attendeeUserIds, guestNames } =
      c.req.valid("json");

    const members = await listChannelMembers(c.env, session.channelId);
    const memberIds = new Set(members.map((member) => member.userId));
    if (attendeeUserIds.some((userId) => !memberIds.has(userId))) {
      return c.json({ error: "Attendee is not a member of this channel." }, 400);
    }

    const booking = await createBooking(c.env, {
      activityId,
      activityTitle: activity.title,
      activityChannelId: activity.channelId,
      createdBy: session.userId,
      date,
      from,
      to,
      description,
      location,
      attendeeUserIds,
      guestNames,
    });

    return c.json({ booking });
  })
  .put(
    "/activities/:id/bookings/:bookingId",
    zValidator("json", createBookingSchema),
    async (c) => {
      const sessionId = getCookie(c, SESSION_COOKIE_NAME);
      const session = sessionId ? await getSessionMeta(c.env, sessionId) : null;
      if (!session) return c.json({ error: "Unauthorized" }, 401);

      const activityId = c.req.param("id");
      const bookingId = c.req.param("bookingId");

      const activity = await getActivityById(c.env, activityId);
      if (!activity || activity.channelId !== session.channelId) {
        return c.json({ error: "Not found" }, 404);
      }

      const booking = await getBookingById(c.env, bookingId);
      if (!booking || booking.activityId !== activityId) {
        return c.json({ error: "Not found" }, 404);
      }
      if (booking.createdBy !== session.userId) {
        return c.json({ error: "Only the booking's creator can edit it." }, 403);
      }

      const { date, from, to, description, location, attendeeUserIds, guestNames } =
        c.req.valid("json");

      const members = await listChannelMembers(c.env, session.channelId);
      const memberIds = new Set(members.map((member) => member.userId));
      if (attendeeUserIds.some((userId) => !memberIds.has(userId))) {
        return c.json({ error: "Attendee is not a member of this channel." }, 400);
      }

      await updateBooking(c.env, {
        bookingId,
        activityTitle: activity.title,
        activityChannelId: activity.channelId,
        createdBy: booking.createdBy,
        date,
        from,
        to,
        description,
        location,
        attendeeUserIds,
        guestNames,
        slackMessageTs: booking.slackMessageTs,
      });

      return c.json({ success: true });
    },
  )
  .get("/bookings/:bookingId/ics", async (c) => {
    // Deliberately public (no session check): the bookingId is an
    // unguessable UUID, and calendar apps/browsers fetching this link won't
    // have our session cookie anyway.
    const bookingId = c.req.param("bookingId");
    const booking = await getBookingById(c.env, bookingId);
    if (!booking) return c.notFound();

    const activity = await getActivityById(c.env, booking.activityId);
    if (!activity) return c.notFound();

    const ics = buildBookingIcs({
      bookingId: booking.id,
      created: booking.created,
      activityTitle: activity.title,
      date: booking.date,
      from: booking.from,
      to: booking.to,
      description: booking.description,
      location: booking.location,
    });

    return c.body(ics, 200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking.ics"`,
    });
  });

if (import.meta.env.DEV) {
  apiRouter.post("/dev/login", async (c) => {
    const { devLogin, DEV_USERS } = await import("../auth/dev-login.ts");
    const userKey = c.req.query("user");
    const key = userKey && userKey in DEV_USERS ? (userKey as keyof typeof DEV_USERS) : "a";
    const session = await devLogin(c.env, key);
    setSessionCookie(c, session);
    return c.json({ success: true });
  });
}
