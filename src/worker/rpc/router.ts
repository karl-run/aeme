import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as z from "zod";

import { createDb } from "../db/db.ts";
import { channelsTable, otpLoginsTable } from "../db/schema.ts";

const insertChannelSchema = z.object({
  name: z.string().min(1),
  suid: z.string().min(1),
});

const loginSchema = z.object({
  otp: z
    .string()
    .length(6)
    .transform((otp) => otp.toUpperCase()),
});

export const apiRouter = new Hono<{ Bindings: Env }>()
  .get("/channel", async (c) => {
    const db = createDb(c.env);
    const channels = await db.select().from(channelsTable);
    return c.json({ channels });
  })
  .post("/channel", zValidator("form", insertChannelSchema), async (c) => {
    const { name, suid } = c.req.valid("form");
    const db = createDb(c.env);
    const [channel] = await db
      .insert(channelsTable)
      .values({ name, channelId: suid, created: new Date().toISOString() })
      .returning();
    return c.json({ channel });
  })
  .delete("/channel/:id", async (c) => {
    const id = c.req.param("id");
    const db = createDb(c.env);
    await db.delete(channelsTable).where(eq(channelsTable.channelId, id));
    return c.json({ message: "deleted" });
  })
  .post("/login", zValidator("form", loginSchema), async (c) => {
    const { otp } = c.req.valid("form");
    const db = createDb(c.env);

    console.log(`login attempt for otp ${otp}`);

    const [otpLogin] = await db.select().from(otpLoginsTable).where(eq(otpLoginsTable.otp, otp));

    if (!otpLogin) {
      console.error(`no otp_logins row for otp ${otp}`);
      return c.json({ success: false }, 400);
    }

    if (otpLogin.expires < new Date().toISOString()) {
      console.error(`otp ${otp} expired at ${otpLogin.expires}`);
      return c.json({ success: false }, 400);
    }

    console.log(`deleting ephemeral message via response_url ${otpLogin.responseUrl}`);

    const response = await fetch(otpLogin.responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delete_original: true }),
    });
    const responseBody = await response.text();

    console.log(`slack response_url replied ${response.status}: ${responseBody}`);

    if (!response.ok) {
      console.error(`failed to delete ephemeral message for otp ${otp}`);
      return c.json({ success: false }, 502);
    }

    return c.json({ success: true });
  });
