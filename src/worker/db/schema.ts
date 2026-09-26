import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users", {
  userId: text("user_id").primaryKey(),
  name: text().notNull(),
  created: text().notNull().unique(),
});

export const channelsTable = sqliteTable("channels", {
  channelId: text("channel_id").primaryKey(),
  name: text().notNull(),
  owner: text("owner")
    .notNull()
    .references(() => usersTable.userId),
  created: text().notNull().unique(),
});

export const otpLoginsTable = sqliteTable(
  "otp_logins",
  {
    otpHash: text("otp_hash").notNull().unique(),
    userId: text("user_id").notNull(),
    channelId: text("channel_id").notNull(),
    created: text().notNull().unique(),
    expires: text().notNull().unique(),
  },
  (t) => [
    check(
      "otp_hash_sha256_hex",
      sql`length(${t.otpHash}) = 64 AND ${t.otpHash} NOT GLOB '*[^a-f0-9]*'`,
    ),
  ],
);

export const sessionsTable = sqliteTable("sessions", {
  id: text().primaryKey(),
  userId: text("user_id").notNull(),
  channelId: text("channel_id").notNull(),
  created: text().notNull(),
  expires: text().notNull(),
});

export type ActivitySlot = {
  date: string;
  from?: string;
  to?: string;
};

export const activitiesTable = sqliteTable(
  "activities",
  {
    id: text().primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channelsTable.channelId),
    title: text().notNull(),
    description: text().notNull(),
    endTime: text("end_time"),
    persistent: integer({ mode: "boolean" }).notNull().default(false),
    slotGranularity: text("slot_granularity", { enum: ["day", "hourly"] })
      .notNull()
      .default("day"),
    archived: integer({ mode: "boolean" }).notNull().default(false),
    created: text().notNull(),
  },
  (t) => [
    check("activities_persistent_no_end_time", sql`${t.persistent} = 0 OR ${t.endTime} IS NULL`),
    check("activities_slot_granularity_valid", sql`${t.slotGranularity} IN ('day', 'hourly')`),
  ],
);

export const activityAvailabilityTable = sqliteTable(
  "activity_availability",
  {
    id: text().primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activitiesTable.id),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.userId),
    slots: text({ mode: "json" }).notNull().$type<ActivitySlot[]>(),
    created: text().notNull(),
    updated: text().notNull(),
  },
  (t) => [uniqueIndex("activity_availability_activity_user").on(t.activityId, t.userId)],
);
