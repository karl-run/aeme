import { zValidator } from "@hono/zod-validator";
import { IncomingWebhook } from "@slack/webhook";
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

    const [otpLogin] = await db.select().from(otpLoginsTable).where(eq(otpLoginsTable.otp, otp));

    if (!otpLogin || otpLogin.expires < new Date().toISOString()) {
      return c.json({ success: false }, 400);
    }

    const webhook = new IncomingWebhook(otpLogin.responseUrl, {
      // Workers' fetch only supports redirect: "follow" | "manual", but @slack/webhook
      // hardcodes "error" — override it here so the request doesn't throw.
      fetch: (input, init) => fetch(input, { ...init, redirect: "manual" }),
    });
    await webhook.send({ delete_original: true });

    return c.json({ success: true });
  });
