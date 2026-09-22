import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import * as z from "zod";

import { createDb } from "../db/db.ts";
import { channelsTable } from "../db/schema.ts";

const insertChannelSchema = z.object({
  name: z.string().min(1),
  suid: z.string().min(1),
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
      .values({ name, slackId: Number(suid), created: new Date().toISOString() })
      .returning();
    return c.json({ channel });
  })
  .delete("/channel/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const db = createDb(c.env);
    await db.delete(channelsTable).where(eq(channelsTable.id, id));
    return c.json({ message: "deleted" });
  });
