import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const channelsTable = sqliteTable("channels", {
  id: int().primaryKey({ autoIncrement: true }),
  slackId: int("slack_id").notNull(),
  name: text().notNull(),
  created: text().notNull().unique(),
});

export const otpLoginsTable = sqliteTable("otp_logins", {
  otp: text().notNull(),
  userId: text("user_id").notNull(),
  channelId: text("channel_id").notNull(),
  created: text().notNull().unique(),
  expires: text().notNull().unique(),
});
