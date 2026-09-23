import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as z from "zod";

import { completeLogin } from "../auth/otp.ts";
import { createDb } from "../db/db.ts";
import { channelsTable } from "../db/schema.ts";

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
    const result = await completeLogin(c.env, otp);

    switch (result.status) {
      case "invalid":
      case "expired":
        return c.json({ success: false }, 400);
      case "notify_failed":
        return c.json({ success: false }, 502);
      case "success":
        return c.json({ success: true });
    }
  });
