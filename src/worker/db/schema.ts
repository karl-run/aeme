import { sql } from "drizzle-orm";
import { check, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    responseUrl: text("response_url").notNull(),
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
