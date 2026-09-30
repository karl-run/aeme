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

/** Durable record that a user belongs to a channel — a user can be a member
 * of multiple channels on the same Slack workspace. Recorded either when they
 * interact with æme from that channel for real (see `ensureChannelMember`),
 * or pre-loaded from Slack's live member list before they've ever logged in
 * (see the profile page's "Add" action) — not kept in sync with Slack after
 * that, just a one-time snapshot either way. */
export const channelMembersTable = sqliteTable(
  "channel_members",
  {
    id: text().primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channelsTable.channelId),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.userId),
    joined: text().notNull(),
  },
  (t) => [uniqueIndex("channel_members_channel_user").on(t.channelId, t.userId)],
);

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
    suggestedDates: text("suggested_dates", { mode: "json" }).$type<string[]>(),
    /** Advisory headcount the organizer is aiming for — purely informational
     * (e.g. shown as "5/8 going"), never enforced as a cap on responses or
     * booking attendees. */
    idealMemberCount: integer("ideal_member_count"),
    /** Slack message timestamp of the suggestion announcement for a
     * non-persistent activity (see `activity_bookings.slack_message_ts` for
     * the analogous field on a booking), so it can be edited in place
     * instead of re-posted. Null for persistent activities, which aren't
     * announced this way. */
    slackMessageTs: text("slack_message_ts"),
    archived: integer({ mode: "boolean" }).notNull().default(false),
    created: text().notNull(),
  },
  (t) => [
    check("activities_persistent_no_end_time", sql`${t.persistent} = 0 OR ${t.endTime} IS NULL`),
    check("activities_slot_granularity_valid", sql`${t.slotGranularity} IN ('day', 'hourly')`),
    check(
      "activities_persistent_no_suggested_dates",
      sql`${t.persistent} = 0 OR ${t.suggestedDates} IS NULL`,
    ),
    check(
      "activities_ideal_member_count_positive",
      sql`${t.idealMemberCount} IS NULL OR ${t.idealMemberCount} > 0`,
    ),
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

/** An actual booked occurrence of an activity — as opposed to `activity_availability`,
 * which only records when users say they *could* meet. Any user in the channel can
 * add one. Persistent activities may accrue many bookings over time; non-persistent
 * (one-off) activities will typically end up with just the one. */
export const activityBookingsTable = sqliteTable(
  "activity_bookings",
  {
    id: text().primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activitiesTable.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => usersTable.userId),
    date: text().notNull(),
    from: text().notNull(),
    to: text().notNull(),
    description: text().notNull().default(""),
    location: text().notNull().default(""),
    /** Slack message timestamp of the announcement post for this booking, so
     * it can be edited in place (via `chat.update`) instead of re-posted as
     * the booking's data changes. Null until the post succeeds. */
    slackMessageTs: text("slack_message_ts"),
    created: text().notNull(),
  },
  (t) => [
    check(
      "activity_bookings_time_format",
      sql`${t.from} GLOB '[0-2][0-9]:[0-5][0-9]' AND ${t.to} GLOB '[0-2][0-9]:[0-5][0-9]'`,
    ),
    check("activity_bookings_from_before_to", sql`${t.from} < ${t.to}`),
  ],
);

/** An attendee is either a channel member (`userId` set, tagged via Slack
 * `<@userId>` mentions) or a guest with no Slack account (`name` set, listed
 * by plain name only — never attempted to be tagged) — exactly one of the
 * two, enforced below. */
export const activityBookingAttendeesTable = sqliteTable(
  "activity_booking_attendees",
  {
    id: text().primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => activityBookingsTable.id),
    userId: text("user_id").references(() => usersTable.userId),
    name: text(),
  },
  (t) => [
    uniqueIndex("activity_booking_attendees_booking_user").on(t.bookingId, t.userId),
    check(
      "activity_booking_attendees_user_or_name",
      sql`(${t.userId} IS NOT NULL AND ${t.name} IS NULL) OR (${t.userId} IS NULL AND ${t.name} IS NOT NULL)`,
    ),
  ],
);
