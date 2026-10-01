import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users", {
  userId: text("user_id").primaryKey(),
  name: text().notNull(),
  created: text().notNull(),
});

export const channelsTable = sqliteTable("channels", {
  channelId: text("channel_id").primaryKey(),
  name: text().notNull(),
  owner: text("owner")
    .notNull()
    .references(() => usersTable.userId),
  created: text().notNull(),
});

export const otpLoginsTable = sqliteTable(
  "otp_logins",
  {
    otpHash: text("otp_hash").notNull().unique(),
    userId: text("user_id").notNull(),
    channelId: text("channel_id").notNull(),
    created: text().notNull(),
    expires: text().notNull(),
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
    /** Nullable since activities created before this field existed have no
     * recorded creator — only the creator may edit an activity. */
    createdBy: text("created_by").references(() => usersTable.userId),
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
    /** Explicitly "I can't make it", as opposed to just not having answered
     * yet — mutually exclusive with having any slots selected. Only
     * surfaced for one-off activities; persistent ones always send `false`. */
    declined: integer({ mode: "boolean" }).notNull().default(false),
    /** "I'm bringing someone." A flag rather than a count — one guest each is
     * the only case worth modelling, and it keeps the headcount arithmetic
     * honest. The guest is anonymous here: whoever books is responsible for
     * typing a name into the booking's guest list. */
    plusOne: integer("plus_one", { mode: "boolean" }).notNull().default(false),
    created: text().notNull(),
    updated: text().notNull(),
  },
  (t) => [
    uniqueIndex("activity_availability_activity_user").on(t.activityId, t.userId),
    check(
      "activity_availability_declined_no_slots",
      sql`${t.declined} = 0 OR json_array_length(${t.slots}) = 0`,
    ),
    check("activity_availability_declined_no_plus_one", sql`${t.declined} = 0 OR ${t.plusOne} = 0`),
  ],
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
    /** Free-text place, used only when no `locationId` is set — the two are
     * mutually exclusive, enforced by the router's zod schema rather than a
     * check constraint, since adding one to this existing table would mean a
     * full SQLite table rebuild. */
    location: text().notNull().default(""),
    /** One of the activity's fixed locations, when the booker picked one
     * instead of typing a place. Always null for a non-persistent activity,
     * which has no fixed locations to pick. */
    locationId: text("location_id").references(() => activityLocationsTable.id),
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

/** A named place a persistent activity repeats at — "the court", "the usual
 * pub" — so booking one doesn't mean retyping the same address every week.
 * Only persistent activities have these (enforced by the router, not a check
 * constraint: SQLite can't express a cross-table one). Picking one is never
 * required; a booking can still carry free-text `location` instead.
 *
 * Retired places are archived rather than deleted, so bookings that already
 * reference them keep rendering — see `archiveActivityLocation`. */
export const activityLocationsTable = sqliteTable(
  "activity_locations",
  {
    id: text().primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activitiesTable.id),
    name: text().notNull(),
    mapsUrl: text("maps_url").notNull(),
    archived: integer({ mode: "boolean" }).notNull().default(false),
    created: text().notNull(),
  },
  (t) => [
    // Partial, so archiving a place frees its name for re-use rather than
    // blocking it forever.
    uniqueIndex("activity_locations_activity_name")
      .on(t.activityId, t.name)
      .where(sql`${t.archived} = 0`),
    check("activity_locations_name_not_empty", sql`length(trim(${t.name})) > 0`),
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
