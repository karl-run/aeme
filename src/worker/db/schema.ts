import { sql } from "drizzle-orm";
import { check, int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const channelsTable = sqliteTable("channels", {
  channelId: text("channel_id").primaryKey(),
  name: text().notNull(),
  created: text().notNull().unique(),
});

export const otpLoginsTable = sqliteTable(
  "otp_logins",
  {
    otp: text().notNull().unique(),
    userId: text("user_id").notNull(),
    channelId: text("channel_id").notNull(),
    created: text().notNull().unique(),
    expires: text().notNull().unique(),
  },
  (t) => [
    check("otp_alphanumeric_length_6", sql`length(${t.otp}) = 6 AND ${t.otp} NOT GLOB '*[^A-Za-z0-9]*'`),
  ],
);

export const sessionsTable = sqliteTable("sessions", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  channelId: text("channel_id")
    .notNull()
    .references(() => channelsTable.channelId),
  otp: text().notNull().unique(),
  status: text().notNull().default("pending"),
  created: text().notNull().unique(),
  expires: text().notNull().unique(),
});
