import { sql } from "drizzle-orm";
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const channelsTable = sqliteTable("channels", {
  channelId: text("channel_id").primaryKey(),
  name: text().notNull(),
  created: text().notNull().unique(),
});

export const usersTable = sqliteTable("users", {
  userId: text("user_id").primaryKey(),
  name: text().notNull(),
  created: text().notNull().unique(),
});

export const otpLoginsTable = sqliteTable(
  "otp_logins",
  {
    otp: text().notNull().unique(),
    userId: text("user_id").notNull(),
    channelId: text("channel_id").notNull(),
    responseUrl: text("response_url").notNull(),
    created: text().notNull().unique(),
    expires: text().notNull().unique(),
  },
  (t) => [
    check(
      "otp_alphanumeric_length_6",
      sql`length(${t.otp}) = 6 AND ${t.otp} NOT GLOB '*[^A-Z0-9]*'`,
    ),
  ],
);

export const sessionsTable = sqliteTable("sessions", {
  id: text().primaryKey(),
  userId: text("user_id").notNull(),
  channelId: text("channel_id").notNull(),
  created: text().notNull().unique(),
  expires: text().notNull().unique(),
});
