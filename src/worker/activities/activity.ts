import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  or,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { BASE_URL, DISPLAY_TIME_ZONE } from "../constants.ts";
import { todayInDisplayZone } from "../dates.ts";
import { createDb, type Db } from "../db/db.ts";
import {
  activitiesTable,
  activityAvailabilityTable,
  activityBookingAttendeesTable,
  activityBookingsTable,
  activityLocationsTable,
  type ActivitySlot,
  usersTable,
} from "../db/schema.ts";
import { deleteMessage, getPermalink, postOrUpdateMessage } from "../slack/messages.ts";

/** Builds the Slack `text` fallback + Block Kit `blocks` announcing a new
 * one-off activity suggestion — persistent activities aren't announced this
 * way, they're just always visible on the dashboard. `responders` is a list
 * of already-formatted `<@userId> (N days)` strings, rebuilt and re-posted
 * (via `chat.update`) each time someone responds. */
const buildActivitySuggestionMessage = (params: {
  title: string;
  description: string;
  suggestedDates: string[] | null;
  endTime: string;
  responders: string[];
  /** Responders plus their guests — what "Available (N)" counts. */
  headcount: number;
  /** The activity's bookings that have a Slack post, in date order. A null
   * `permalink` (the lookup failed) still lists the booking, just unlinked. */
  bookings: { date: string; from: string; to: string; permalink: string | null }[];
  decliners: string[];
}) => {
  const formattedDates = params.suggestedDates
    ?.map((date) =>
      new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    )
    .join(", ");

  const deadline = new Date(params.endTime).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
  });

  const text = `📋 New suggestion: ${params.title}`;

  const blocks = [
    { type: "header", text: { type: "plain_text", text: `📋 ${params.title}`, emoji: true } },
    ...(params.description
      ? [{ type: "section", text: { type: "mrkdwn", text: params.description } }]
      : []),
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: formattedDates ? `📅 Suggested: ${formattedDates}` : "📅 Propose any date that works",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          params.responders.length > 0
            ? `👥 *Available (${params.headcount})*\n${params.responders.join(", ")}`
            : "👥 _No responses yet._",
      },
    },
    ...(params.bookings.length > 0
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🗓️ *Booked*\n${params.bookings
                .map((booking) => {
                  const label = `${new Date(`${booking.date}T00:00:00`).toLocaleDateString(
                    "en-US",
                    { weekday: "short", month: "short", day: "numeric" },
                  )} · ${booking.from}–${booking.to}`;
                  return booking.permalink ? `<${booking.permalink}|${label}>` : label;
                })
                .join("\n")}`,
            },
          },
        ]
      : []),
    ...(params.decliners.length > 0
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🚫 *Can't make it (${params.decliners.length})*\n${params.decliners.join(", ")}`,
            },
          },
        ]
      : []),
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `⏰ Respond by ${deadline}` },
        { type: "mrkdwn", text: `<${BASE_URL}|Open æme to respond>` },
      ],
    },
  ];

  return { text, blocks };
};

/** (Re-)posts the Slack announcement for a one-off activity's suggestion,
 * reflecting the current set of responses and links to its booking posts — edited in place via
 * `chat.update` once a post exists. No-ops for persistent activities, which
 * aren't announced this way. Call after creating the activity and again
 * whenever someone upserts their availability or a booking changes. */
export const announceActivitySuggestion = async (env: Env, activityId: string): Promise<void> => {
  const db = createDb(env);

  const [activity] = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.id, activityId));
  if (!activity || activity.persistent) return;

  const availabilityRows = await db
    .select({
      userId: activityAvailabilityTable.userId,
      slots: activityAvailabilityTable.slots,
      declined: activityAvailabilityTable.declined,
      plusOne: activityAvailabilityTable.plusOne,
    })
    .from(activityAvailabilityTable)
    .where(eq(activityAvailabilityTable.activityId, activityId));

  const available = availabilityRows.filter((row) => row.slots.length > 0);
  const responders = available.map((row) => {
    const days = new Set(row.slots.map((slot) => slot.date)).size;
    return `<@${row.userId}>${row.plusOne ? " +1" : ""} (${days} day${days === 1 ? "" : "s"})`;
  });
  // Heads, not rows: a +1 is another person at the table.
  const headcount = available.length + available.filter((row) => row.plusOne).length;
  const decliners = availabilityRows.filter((row) => row.declined).map((row) => `<@${row.userId}>`);

  const bookingRows = await db
    .select({
      date: activityBookingsTable.date,
      from: activityBookingsTable.from,
      to: activityBookingsTable.to,
      slackMessageTs: activityBookingsTable.slackMessageTs,
    })
    .from(activityBookingsTable)
    .where(
      and(
        eq(activityBookingsTable.activityId, activityId),
        isNotNull(activityBookingsTable.slackMessageTs),
      ),
    )
    .orderBy(asc(activityBookingsTable.date), asc(activityBookingsTable.from));
  const bookings = await Promise.all(
    bookingRows.map(async (row) => ({
      date: row.date,
      from: row.from,
      to: row.to,
      permalink: await getPermalink(env, { channel: activity.channelId, ts: row.slackMessageTs! }),
    })),
  );

  const { text, blocks } = buildActivitySuggestionMessage({
    title: activity.title,
    description: activity.description,
    suggestedDates: activity.suggestedDates,
    // Guaranteed non-null for a non-persistent activity — enforced by the
    // router's zod schema and the matching DB check constraint.
    endTime: activity.endTime!,
    responders,
    headcount,
    bookings,
    decliners,
  });

  const ts = await postOrUpdateMessage(env, {
    channel: activity.channelId,
    existingTs: activity.slackMessageTs,
    text,
    blocks,
  });

  if (ts) {
    await db
      .update(activitiesTable)
      .set({ slackMessageTs: ts })
      .where(eq(activitiesTable.id, activityId));
  }
};

/** One user's answer to an activity: the slots they said they could make,
 * or an explicit decline (never both — enforced by a DB check constraint). */
export type ActivityResponse = {
  userId: string;
  name: string;
  /** The user's own color, which their part of a grid cell is drawn in. */
  color: string;
  slots: ActivitySlot[];
  declined: boolean;
  /** Bringing one guest. Anonymous until someone books and types a name. */
  plusOne: boolean;
};

/** One of a persistent activity's fixed places, as the client gets it. The
 * two optional fields are either set and meaningful or null — never blank. */
export type ActivityLocation = {
  id: string;
  name: string;
  mapsUrl: string;
  /** The place's own reservation page, when it has one. */
  bookingUrl: string | null;
  /** The spelling Google Maps knows the place by, when it differs from
   * `name` — see `buildBookingGoogleCalendarUrl`. */
  mapsPlaceName: string | null;
};

export const createActivity = async (
  env: Env,
  params: {
    channelId: string;
    createdBy: string;
    title: string;
    description: string;
    endTime: string | null;
    persistent: boolean;
    slotGranularity: "day" | "hourly";
    suggestedDates: string[] | null;
    idealMemberCount: number | null;
    maxMemberCount: number | null;
  },
) => {
  const db = createDb(env);

  const [activity] = await db
    .insert(activitiesTable)
    .values({
      id: crypto.randomUUID(),
      channelId: params.channelId,
      createdBy: params.createdBy,
      title: params.title,
      description: params.description,
      endTime: params.persistent ? null : params.endTime,
      persistent: params.persistent,
      slotGranularity: params.slotGranularity,
      suggestedDates: params.persistent ? null : params.suggestedDates,
      idealMemberCount: params.idealMemberCount,
      maxMemberCount: params.maxMemberCount,
      archived: false,
      created: new Date().toISOString(),
    })
    .returning();

  await announceActivitySuggestion(env, activity.id);

  // Re-fetch rather than return the pre-announcement row: the announcement
  // may have just written `slackMessageTs` onto it.
  return getActivityById(env, activity.id);
};

/** Only the activity's creator may call this (enforced by the router) — the
 * type (persistent vs. one-off) and its granularity/deadline are fixed at
 * creation and not editable here. `suggestedDates` is ignored for a
 * persistent activity (which never has any, enforced by a DB check
 * constraint) regardless of what's passed. Narrowing `suggestedDates` never
 * touches existing `activity_availability` rows — a response for a date
 * that's since been removed just stays stored, invisible until the date is
 * re-added. */
export const updateActivity = async (
  env: Env,
  params: {
    activityId: string;
    title: string;
    description: string;
    idealMemberCount: number | null;
    maxMemberCount: number | null;
    suggestedDates: string[] | null;
  },
) => {
  const db = createDb(env);

  const [existing] = await db
    .select({ persistent: activitiesTable.persistent })
    .from(activitiesTable)
    .where(eq(activitiesTable.id, params.activityId));
  if (!existing) return null;

  await db
    .update(activitiesTable)
    .set({
      title: params.title,
      description: params.description,
      idealMemberCount: params.idealMemberCount,
      maxMemberCount: params.maxMemberCount,
      suggestedDates: existing.persistent ? null : params.suggestedDates,
    })
    .where(eq(activitiesTable.id, params.activityId));

  await announceActivitySuggestion(env, params.activityId);

  return getActivityById(env, params.activityId);
};

/** The booking columns every caller needs, with the booker's name and the
 * fixed location (if any) joined in. The location join is left, and
 * deliberately not filtered on `archived`: a booking that used a
 * since-retired place still shows where it was. */
const selectBookings = (db: Db) =>
  db
    .select({
      id: activityBookingsTable.id,
      activityId: activityBookingsTable.activityId,
      date: activityBookingsTable.date,
      from: activityBookingsTable.from,
      to: activityBookingsTable.to,
      description: activityBookingsTable.description,
      location: activityBookingsTable.location,
      locationId: activityBookingsTable.locationId,
      locationName: activityLocationsTable.name,
      locationMapsUrl: activityLocationsTable.mapsUrl,
      locationBookingUrl: activityLocationsTable.bookingUrl,
      createdBy: activityBookingsTable.createdBy,
      createdByName: usersTable.name,
    })
    .from(activityBookingsTable)
    .innerJoin(usersTable, eq(usersTable.userId, activityBookingsTable.createdBy))
    .leftJoin(
      activityLocationsTable,
      eq(activityLocationsTable.id, activityBookingsTable.locationId),
    );

type BookingRow = Awaited<ReturnType<ReturnType<typeof selectBookings>["execute"]>>[number];

/** The attendees of whichever bookings `bookingIds` picks out, named —
 * channel members via the `users` join, guests by the free-text name on
 * their own row.
 *
 * Statement-only, and `bookingIds` is a subquery rather than a list of ids
 * the worker read back first, so this can go in the same batch as the
 * statement selecting the bookings instead of waiting a round trip for it. */
const selectAttendees = (db: Db, bookingIds: SQLWrapper) =>
  db
    .select({
      bookingId: activityBookingAttendeesTable.bookingId,
      userId: activityBookingAttendeesTable.userId,
      name: sql<string>`coalesce(${usersTable.name}, ${activityBookingAttendeesTable.name})`,
      // Null for a guest, who has no profile to pick one on.
      color: usersTable.color,
    })
    .from(activityBookingAttendeesTable)
    .leftJoin(usersTable, eq(usersTable.userId, activityBookingAttendeesTable.userId))
    .where(inArray(activityBookingAttendeesTable.bookingId, bookingIds));

type AttendeeRow = Awaited<ReturnType<ReturnType<typeof selectAttendees>["execute"]>>[number];

/** Someone on a booking: a channel member with their profile color, or a
 * guest, who has a name and nothing else. */
type Attendee = { userId: string | null; name: string; color: string | null };

/** Turns booking rows into what the client renders — attendees named and the
 * fixed location folded into one object. Returned in the order it was given,
 * so a caller holding the rows can pair the two up by index.
 *
 * Pure: both callers fetch `attendeeRows` alongside the bookings rather than
 * after them, so there's nothing here to await. */
const shapeBookings = (rows: BookingRow[], attendeeRows: AttendeeRow[]) => {
  const attendeeNamesByBooking = new Map<string, string[]>();
  const attendeeIdsByBooking = new Map<string, string[]>();
  const guestNamesByBooking = new Map<string, string[]>();
  for (const row of attendeeRows) {
    const names = attendeeNamesByBooking.get(row.bookingId) ?? [];
    names.push(row.name);
    attendeeNamesByBooking.set(row.bookingId, names);

    if (row.userId) {
      const ids = attendeeIdsByBooking.get(row.bookingId) ?? [];
      ids.push(row.userId);
      attendeeIdsByBooking.set(row.bookingId, ids);
    } else {
      const guestNames = guestNamesByBooking.get(row.bookingId) ?? [];
      guestNames.push(row.name);
      guestNamesByBooking.set(row.bookingId, guestNames);
    }
  }

  return rows.map((booking) => ({
    id: booking.id,
    date: booking.date,
    from: booking.from,
    to: booking.to,
    description: booking.description,
    location: booking.location,
    fixedLocation:
      booking.locationId && booking.locationName && booking.locationMapsUrl
        ? {
            id: booking.locationId,
            name: booking.locationName,
            mapsUrl: booking.locationMapsUrl,
            bookingUrl: booking.locationBookingUrl,
          }
        : null,
    createdBy: booking.createdBy,
    createdByName: booking.createdByName,
    attendeeUserIds: attendeeIdsByBooking.get(booking.id) ?? [],
    guestNames: guestNamesByBooking.get(booking.id) ?? [],
    attendeeNames: attendeeNamesByBooking.get(booking.id) ?? [],
  }));
};

type ShapedBooking = ReturnType<typeof shapeBookings>[number];

/** How many past bookings one page of history carries. The client asks for a
 * page at a time, so this only bounds the request it doesn't send a size for. */
export const PAST_BOOKINGS_PAGE_SIZE = 20;

/** Where the next page of history resumes: the last booking of the page
 * before it. A position rather than an offset, so a booking slipping from
 * "upcoming" into "past" at midnight — which shifts every offset by one —
 * can't make the next page skip a row or repeat one.
 *
 * `id` is in here only to break ties: two bookings can share a date and a
 * start time, and without it the pair would be an unorderable pause point. */
export type PastBookingCursor = { date: string; from: string; id: string };

/** `date|from|id`, for travelling as one opaque query parameter. The parts
 * are fixed-format (`YYYY-MM-DD`, `HH:MM`) or a UUID, so none can contain the
 * separator. */
export const encodePastBookingCursor = (cursor: PastBookingCursor) =>
  `${cursor.date}|${cursor.from}|${cursor.id}`;

/** Null for anything that isn't a cursor this encoded — a hand-typed or
 * truncated one reads as "start from the beginning" rather than an error. */
export const decodePastBookingCursor = (raw: string | undefined): PastBookingCursor | null => {
  if (!raw) return null;
  const [date, from, ...rest] = raw.split("|");
  const id = rest.join("|");
  if (!date || !from || !id) return null;
  return { date, from, id };
};

/** One page of a persistent activity's finished bookings, newest first.
 *
 * Kept out of `listActivitiesForChannel` on purpose: that payload is polled
 * every few seconds and a standing activity's history only ever grows, so the
 * past is counted there and fetched here, a page at a time, when someone asks
 * to see it. The count the client shows before any of this loads comes from
 * that poll (`pastBookingCount`), not from here — so naming the total costs
 * nothing extra.
 *
 * `nextCursor` is null on the last page. */
export const listPastBookingsForActivity = async (
  env: Env,
  activityId: string,
  params: { limit?: number; after?: PastBookingCursor | null } = {},
) => {
  const db = createDb(env);
  const today = todayInDisplayZone();
  const limit = params.limit ?? PAST_BOOKINGS_PAGE_SIZE;

  const isPast = and(
    eq(activityBookingsTable.activityId, activityId),
    lt(activityBookingsTable.date, today),
    // Row-value comparison, matching the `order by` below exactly: everything
    // that sorts strictly after the cursor's position.
    params.after
      ? sql`(${activityBookingsTable.date}, ${activityBookingsTable.from}, ${activityBookingsTable.id}) < (${params.after.date}, ${params.after.from}, ${params.after.id})`
      : undefined,
  );

  // One more than asked for: whether that row exists is how we know there's a
  // page after this one, without counting the whole history to find out.
  const pageIds = db
    .select({ id: activityBookingsTable.id })
    .from(activityBookingsTable)
    .where(isPast)
    .orderBy(
      desc(activityBookingsTable.date),
      desc(activityBookingsTable.from),
      desc(activityBookingsTable.id),
    )
    .limit(limit);

  const [rows, attendeeRows] = await db.batch([
    selectBookings(db)
      .where(isPast)
      .orderBy(
        desc(activityBookingsTable.date),
        desc(activityBookingsTable.from),
        desc(activityBookingsTable.id),
      )
      .limit(limit + 1),
    selectAttendees(db, pageIds),
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    bookings: shapeBookings(page, attendeeRows),
    nextCursor: hasMore && last ? { date: last.date, from: last.from, id: last.id } : null,
  };
};

/** Every booking in the channel between two dates, inclusive, earliest
 * first — what the calendar page draws one month at a time.
 *
 * Channel-wide and date-bounded, which is the opposite of how the rest of
 * this file reads bookings (per activity, split into past and upcoming), so
 * it's its own query rather than a filter over the dashboard payload: that
 * one carries no finished bookings at all for a persistent activity, and
 * browsing back through the year is most of what a calendar is for.
 *
 * The range is the client's visible grid, not a calendar month — a month
 * view shows the days either side of it, and those bookings should be on
 * screen too. Bookings of an archived activity are left out, as everywhere
 * else.
 *
 * Each booking carries the activity it belongs to: the calendar shows every
 * activity at once, so the title is what tells two bookings on the same day
 * apart, and `idealMemberCount` is there for the "3/4 going" the details
 * dialog shows. */
export const listChannelBookingsInRange = async (
  env: Env,
  channelId: string,
  range: { from: string; to: string },
) => {
  const db = createDb(env);

  const inChannel = and(
    eq(activitiesTable.channelId, channelId),
    eq(activitiesTable.archived, false),
  );
  // A subquery rather than ids read back first, so all three statements can
  // go in one batch — see `listActivitiesForChannel`.
  const channelActivityIds = db
    .select({ id: activitiesTable.id })
    .from(activitiesTable)
    .where(inChannel);

  const inRange = and(
    inArray(activityBookingsTable.activityId, channelActivityIds),
    gte(activityBookingsTable.date, range.from),
    lte(activityBookingsTable.date, range.to),
  );
  const rangeBookingIds = db
    .select({ id: activityBookingsTable.id })
    .from(activityBookingsTable)
    .where(inRange);

  const [bookingRows, attendeeRows, activityRows] = await db.batch([
    selectBookings(db)
      .where(inRange)
      .orderBy(
        asc(activityBookingsTable.date),
        asc(activityBookingsTable.from),
        asc(activityBookingsTable.id),
      ),
    selectAttendees(db, rangeBookingIds),
    // The titles, fetched whole rather than joined onto every booking row: a
    // channel has a handful of activities and a month has many more
    // bookings, so this is the smaller thing to send twice.
    db
      .select({
        id: activitiesTable.id,
        title: activitiesTable.title,
        idealMemberCount: activitiesTable.idealMemberCount,
      })
      .from(activitiesTable)
      .where(inChannel),
  ]);

  const activityById = new Map(activityRows.map((activity) => [activity.id, activity]));
  const shaped = shapeBookings(bookingRows, attendeeRows);

  // The same people `shapeBookings` names, with the color each one picked —
  // the calendar draws them as badges rather than a line of text, and a
  // color per person is what makes a day readable at a glance. It's the one
  // column `attendeeNames` can't carry, so they travel alongside it.
  const attendeesByBooking = new Map<string, Attendee[]>();
  for (const row of attendeeRows) {
    const list = attendeesByBooking.get(row.bookingId) ?? [];
    list.push({ userId: row.userId, name: row.name, color: row.color });
    attendeesByBooking.set(row.bookingId, list);
  }

  // Paired by index with the rows they were shaped from — `shapeBookings`
  // keeps the order it was given.
  return bookingRows.map((row, index) => {
    const activity = activityById.get(row.activityId);

    return {
      ...shaped[index],
      activityId: row.activityId,
      activityTitle: activity?.title ?? "",
      idealMemberCount: activity?.idealMemberCount ?? null,
      attendees: attendeesByBooking.get(row.id) ?? [],
    };
  });
};

export const getActivityById = async (env: Env, id: string) => {
  const db = createDb(env);

  const [activity] = await db.select().from(activitiesTable).where(eq(activitiesTable.id, id));

  return activity ?? null;
};

export const listActivitiesForChannel = async (env: Env, channelId: string, userId: string) => {
  const db = createDb(env);
  const today = todayInDisplayZone();

  // Everything below filters on the same set of activities, and none of it
  // needs a previous answer to say which: the id list goes as a subquery
  // rather than an `in (?, ?, …)` the worker fills in from the round trip
  // before. That's what lets all six statements go as one batch — against a
  // hosted database this is the difference between six network hops and one.
  const inChannel = and(
    eq(activitiesTable.channelId, channelId),
    eq(activitiesTable.archived, false),
  );
  const channelActivityIds = db
    .select({ id: activitiesTable.id })
    .from(activitiesTable)
    .where(inChannel);

  // A persistent activity keeps collecting bookings forever and this payload
  // is polled every few seconds, so it carries only what's still to come —
  // the rest is counted separately and fetched on demand by
  // `listPastBookingsForActivity`. A one-off keeps all of its handful: its
  // card is a record of what was decided, past bookings included. Asking
  // `activities.persistent` directly is what lets that be one statement
  // rather than a filter assembled from ids already in hand.
  const inBookingWindow = and(
    inArray(activityBookingsTable.activityId, channelActivityIds),
    or(gte(activityBookingsTable.date, today), eq(activitiesTable.persistent, false)),
  );
  const windowedBookingIds = db
    .select({ id: activityBookingsTable.id })
    .from(activityBookingsTable)
    .innerJoin(activitiesTable, eq(activitiesTable.id, activityBookingsTable.activityId))
    .where(inBookingWindow);

  const [rows, availabilityRows, locationRows, bookingRows, pastCountRows, attendeeRows] =
    await db.batch([
      db
        .select({
          id: activitiesTable.id,
          createdBy: activitiesTable.createdBy,
          title: activitiesTable.title,
          description: activitiesTable.description,
          endTime: activitiesTable.endTime,
          persistent: activitiesTable.persistent,
          slotGranularity: activitiesTable.slotGranularity,
          suggestedDates: activitiesTable.suggestedDates,
          idealMemberCount: activitiesTable.idealMemberCount,
          maxMemberCount: activitiesTable.maxMemberCount,
          created: activitiesTable.created,
          slots: activityAvailabilityTable.slots,
          declined: activityAvailabilityTable.declined,
          plusOne: activityAvailabilityTable.plusOne,
        })
        .from(activitiesTable)
        .leftJoin(
          activityAvailabilityTable,
          and(
            eq(activityAvailabilityTable.activityId, activitiesTable.id),
            eq(activityAvailabilityTable.userId, userId),
          ),
        )
        .where(inChannel)
        .orderBy(activitiesTable.created),

      db
        .select({
          activityId: activityAvailabilityTable.activityId,
          userId: activityAvailabilityTable.userId,
          name: usersTable.name,
          color: usersTable.color,
          slots: activityAvailabilityTable.slots,
          declined: activityAvailabilityTable.declined,
          plusOne: activityAvailabilityTable.plusOne,
        })
        .from(activityAvailabilityTable)
        .innerJoin(usersTable, eq(usersTable.userId, activityAvailabilityTable.userId))
        .where(inArray(activityAvailabilityTable.activityId, channelActivityIds)),

      db
        .select({
          id: activityLocationsTable.id,
          activityId: activityLocationsTable.activityId,
          name: activityLocationsTable.name,
          mapsUrl: activityLocationsTable.mapsUrl,
          bookingUrl: activityLocationsTable.bookingUrl,
          mapsPlaceName: activityLocationsTable.mapsPlaceName,
        })
        .from(activityLocationsTable)
        .where(
          and(
            inArray(activityLocationsTable.activityId, channelActivityIds),
            eq(activityLocationsTable.archived, false),
          ),
        )
        .orderBy(activityLocationsTable.created),

      selectBookings(db)
        .innerJoin(activitiesTable, eq(activitiesTable.id, activityBookingsTable.activityId))
        .where(inBookingWindow),

      db
        .select({
          activityId: activityBookingsTable.activityId,
          count: sql<number>`count(*)`,
        })
        .from(activityBookingsTable)
        .innerJoin(activitiesTable, eq(activitiesTable.id, activityBookingsTable.activityId))
        .where(
          and(
            inChannel,
            eq(activitiesTable.persistent, true),
            lt(activityBookingsTable.date, today),
          ),
        )
        .groupBy(activityBookingsTable.activityId),

      selectAttendees(db, windowedBookingIds),
    ]);

  // Named rather than tallied: the client needs to show *who* picked a slot,
  // not just how many did — the same identities the Slack announcement
  // already lists (see `announceActivitySuggestion`). Per-slot counts are
  // derived from these client-side (see `lib/responders.ts`), so the two
  // never disagree. The current user's own row is included; callers filter
  // it out where a count should mean "other people".
  const responsesByActivity = new Map<string, ActivityResponse[]>();
  for (const row of availabilityRows) {
    // A row with neither slots nor a decline is someone who cleared their
    // answer — not a response.
    if (row.slots.length === 0 && !row.declined) continue;

    const list = responsesByActivity.get(row.activityId) ?? [];
    list.push({
      userId: row.userId,
      name: row.name,
      color: row.color,
      slots: row.slots,
      declined: row.declined,
      plusOne: row.plusOne,
    });
    responsesByActivity.set(row.activityId, list);
  }

  const locationsByActivity = new Map<string, ActivityLocation[]>();
  for (const row of locationRows) {
    const list = locationsByActivity.get(row.activityId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      mapsUrl: row.mapsUrl,
      bookingUrl: row.bookingUrl,
      mapsPlaceName: row.mapsPlaceName,
    });
    locationsByActivity.set(row.activityId, list);
  }

  const pastCountByActivity = new Map(pastCountRows.map((row) => [row.activityId, row.count]));

  const shapedBookings = shapeBookings(bookingRows, attendeeRows);

  const bookedSlotsByActivity = new Map<string, Record<string, boolean>>();
  const bookingsByActivity = new Map<string, ShapedBooking[]>();
  bookingRows.forEach((booking, index) => {
    const booked = bookedSlotsByActivity.get(booking.activityId) ?? {};
    booked[booking.date] = true;
    bookedSlotsByActivity.set(booking.activityId, booked);

    const list = bookingsByActivity.get(booking.activityId) ?? [];
    list.push(shapedBookings[index]);
    bookingsByActivity.set(booking.activityId, list);
  });

  return rows.map((row) => ({
    ...row,
    slots: row.slots ?? [],
    declined: row.declined ?? false,
    plusOne: row.plusOne ?? false,
    responses: responsesByActivity.get(row.id) ?? [],
    locations: locationsByActivity.get(row.id) ?? [],
    bookedSlots: bookedSlotsByActivity.get(row.id) ?? {},
    bookings: bookingsByActivity.get(row.id) ?? [],
    /** How many of this activity's bookings are already done — always 0 for a
     * one-off, whose past bookings are in `bookings` above. */
    pastBookingCount: pastCountByActivity.get(row.id) ?? 0,
  }));
};

/** Whether anything has been booked for this activity — the one thing that
 * blocks deleting it, since a booking has its own Slack post and its own
 * attendees who are expecting it to happen. */
export const activityHasBookings = async (env: Env, activityId: string): Promise<boolean> => {
  const db = createDb(env);

  const [booking] = await db
    .select({ id: activityBookingsTable.id })
    .from(activityBookingsTable)
    .where(eq(activityBookingsTable.activityId, activityId))
    .limit(1);

  return booking !== undefined;
};

/** Removes an activity and everything hanging off it. Only the creator may
 * call this, and only while it has no bookings (both enforced by the router).
 *
 * Availability rows and fixed locations go with it via ON DELETE CASCADE, so
 * unlike `deleteBooking` there's nothing to hand-cascade here. The Slack
 * suggestion post is deleted afterwards on a best-effort basis, for the same
 * reason: an outage should leave a stale post rather than block the delete
 * the user asked for. */
export const deleteActivity = async (
  env: Env,
  params: { activityId: string; channelId: string; slackMessageTs: string | null },
) => {
  const db = createDb(env);

  await db.delete(activitiesTable).where(eq(activitiesTable.id, params.activityId));

  if (params.slackMessageTs) {
    await deleteMessage(env, { channel: params.channelId, ts: params.slackMessageTs });
  }
};

/** The identity a row is counted under: the id when there is one, and
 * otherwise the typed name, trimmed and case-folded the way `foldByName`
 * describes. `foldByName` and `foldPairs` have to agree on this exactly —
 * the pair rows carry nothing but these keys, and the client looks each one
 * up in the attendance list to find out whose it is. */
const personKey = (id: string | null, name: string | null, prefix: string) =>
  id ?? `${prefix}:${(name ?? "").trim().toLowerCase()}`;

/** How many of this activity's finished bookings each person turned up to,
 * most-attended first.
 *
 * Counted by SQLite in one round trip rather than by walking the bookings in
 * the worker: a standing activity accumulates history without end, and the
 * CPU budget here is single-digit milliseconds. The worker only serializes
 * the handful of rows that come back — one per person, not one per booking.
 *
 * Members are grouped by user id so a rename doesn't split someone's history
 * in two; guests, who have no id, are grouped by the name that was typed, so
 * the same spelling counts as the same person and a different one doesn't.
 * Only past bookings count: what's still coming up hasn't been attended. */
/** Merges rows that differ only in how a name was typed, most-used first.
 *
 * Anything with an `id` — a member, a fixed location — is already one row
 * per thing and passes straight through. Free text is whatever someone typed
 * into the booking form, so the same person turns up as "Silje" and "silje"
 * and the same place as "Stadium" and "stadium". Those are folded here with
 * JavaScript's `toLowerCase`, which unlike SQLite's knows that "Ø" and "ø"
 * are the same letter.
 *
 * The spelling shown is the one used most often, so a single stray
 * lowercasing doesn't rename anyone; ties go to whichever sorts first, which
 * puts the capitalized form ahead of the bare one. Cheap either way — this
 * runs over one row per thing, not one per booking. */
const foldByName = (
  rows: readonly { id: string | null; name: string; count: number }[],
  prefix: string,
) => {
  const folded = new Map<string, { key: string; name: string; count: number; spelling: number }>();

  for (const row of rows) {
    const key = personKey(row.id, row.name, prefix);
    const existing = folded.get(key);

    if (!existing) {
      folded.set(key, { key, name: row.name, count: row.count, spelling: row.count });
      continue;
    }

    existing.count += row.count;
    if (
      row.count > existing.spelling ||
      (row.count === existing.spelling && row.name < existing.name)
    ) {
      existing.name = row.name;
      existing.spelling = row.count;
    }
  }

  return (
    [...folded.values()]
      // Name breaks ties, so an unchanged history always renders in the same
      // order instead of shuffling between requests.
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map(({ key, name, count }) => ({ key, name, count }))
  );
};

/** Co-attendance, folded the way `foldByName` folds the singles: one row
 * per unordered pair, counted over the bookings both of them were on.
 *
 * SQLite has already done the pairing and the counting; what's left is the
 * case-folding it can't do, which can merge two of its rows into one —
 * "Silje" with Karl and "silje" with Karl are the same pair. Case-folding
 * can also reorder a pair, so the ends are sorted again here rather than
 * trusted from the `<` the join applied to the raw keys. */
const foldPairs = (
  rows: readonly {
    leftId: string | null;
    leftName: string | null;
    rightId: string | null;
    rightName: string | null;
    count: number;
  }[],
) => {
  const folded = new Map<string, { a: string; b: string; count: number }>();

  for (const row of rows) {
    const left = personKey(row.leftId, row.leftName, "guest");
    const right = personKey(row.rightId, row.rightName, "guest");
    const [a, b] = left < right ? [left, right] : [right, left];

    const existing = folded.get(`${a}|${b}`);
    if (existing) existing.count += row.count;
    else folded.set(`${a}|${b}`, { a, b, count: row.count });
  }

  return [...folded.values()];
};

/** What the finished bookings of an activity add up to: how often each person
 * came, and how often each place was used.
 *
 * Counted by SQLite in one round trip rather than by walking the bookings in
 * the worker: a standing activity accumulates history without end, and the
 * CPU budget here is single-digit milliseconds. The worker only serializes
 * the handful of rows that come back — one per person and one per place,
 * never one per booking.
 *
 * Only past bookings count: what's still coming up hasn't happened yet. */
/** A booking's span as the whole hours it touches: 18:00–20:00 occupies the
 * 18:00 and 19:00 hours, 18:30–19:15 occupies 18:00 and 19:00. Half-open at
 * the end, so a booking finishing on the hour doesn't claim the hour it
 * finishes in — otherwise every two-hour booking would read as three.
 *
 * Grouped rows rather than one per booking: the same weekday and the same
 * slot recur week after week, so the group-by collapses a season of padel
 * into a handful of rows before any of this runs. */
const toHourCells = (
  rows: readonly { weekday: string | null; from: string; to: string; count: number }[],
) => {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const counts = new Map<string, { weekday: number; hour: number; count: number }>();

  for (const row of rows) {
    // `strftime('%w')` counts from Sunday; ISO-8601 counts from Monday, which
    // is how the week is read here and how the client orders the columns.
    const sqliteWeekday = Number(row.weekday);
    const weekday = sqliteWeekday === 0 ? 7 : sqliteWeekday;

    const firstHour = Math.floor(minutes(row.from) / 60);
    const endHour = Math.ceil(minutes(row.to) / 60);

    for (let hour = firstHour; hour < endHour; hour++) {
      const key = `${weekday}:${hour}`;
      const cell = counts.get(key) ?? { weekday, hour, count: 0 };
      cell.count += row.count;
      counts.set(key, cell);
    }
  }

  return [...counts.values()];
};

export const getBookingStatsForActivity = async (env: Env, activityId: string) => {
  const db = createDb(env);
  const today = todayInDisplayZone();

  const isPast = and(
    eq(activityBookingsTable.activityId, activityId),
    lt(activityBookingsTable.date, today),
  );

  // Members group by account so a rename doesn't split someone's history;
  // guests, who have no account, group by the name that was typed and are
  // folded case-insensitively afterwards.
  const person = sql<string>`coalesce(${activityBookingAttendeesTable.userId}, 'guest:' || trim(${activityBookingAttendeesTable.name}))`;
  // Same shape for places: a fixed location by id, free text by what was
  // typed. The join isn't filtered on `archived` — a retired place is still
  // where those bookings happened.
  const place = sql<string>`coalesce(${activityBookingsTable.locationId}, 'free:' || trim(${activityBookingsTable.location}))`;
  const count = sql<number>`count(*)`;

  // Two copies of the attendee list, to pair a booking's attendees up with
  // each other. The same person expression is built over each.
  const pairLeft = alias(activityBookingAttendeesTable, "pair_left");
  const pairRight = alias(activityBookingAttendeesTable, "pair_right");
  const leftPerson = sql<string>`coalesce(${pairLeft.userId}, 'guest:' || trim(${pairLeft.name}))`;
  const rightPerson = sql<string>`coalesce(${pairRight.userId}, 'guest:' || trim(${pairRight.name}))`;

  const [attendanceRows, locationRows, bookingCountRows, slotRows, pairRows] = await db.batch([
    db
      .select({
        id: activityBookingAttendeesTable.userId,
        name: sql<string>`coalesce(${usersTable.name}, trim(${activityBookingAttendeesTable.name}))`,
        count,
      })
      .from(activityBookingAttendeesTable)
      .innerJoin(
        activityBookingsTable,
        eq(activityBookingsTable.id, activityBookingAttendeesTable.bookingId),
      )
      .leftJoin(usersTable, eq(usersTable.userId, activityBookingAttendeesTable.userId))
      .where(isPast)
      .groupBy(person),

    db
      .select({
        id: activityBookingsTable.locationId,
        name: sql<string>`coalesce(${activityLocationsTable.name}, trim(${activityBookingsTable.location}))`,
        count,
      })
      .from(activityBookingsTable)
      .leftJoin(
        activityLocationsTable,
        eq(activityLocationsTable.id, activityBookingsTable.locationId),
      )
      .where(
        and(
          isPast,
          // Bookings with nowhere recorded are left out rather than bundled
          // into an "unknown" bar: it would usually be the tallest one and
          // says nothing about where anyone plays.
          or(
            isNotNull(activityBookingsTable.locationId),
            sql`trim(${activityBookingsTable.location}) <> ''`,
          ),
        ),
      )
      .groupBy(place),

    db
      .select({ count: sql<number>`count(*)` })
      .from(activityBookingsTable)
      .where(isPast),

    // When they played, grouped by weekday and slot. The hour-by-hour
    // expansion happens in the worker: SQLite would need a recursive CTE to
    // walk a booking's span, and there are only ever a handful of distinct
    // slots to walk.
    db
      .select({
        weekday: sql<string>`strftime('%w', ${activityBookingsTable.date})`,
        from: activityBookingsTable.from,
        to: activityBookingsTable.to,
        count,
      })
      .from(activityBookingsTable)
      .where(isPast)
      .groupBy(
        sql`strftime('%w', ${activityBookingsTable.date})`,
        activityBookingsTable.from,
        activityBookingsTable.to,
      ),

    // Who keeps turning up with whom: every unordered pair of people on the
    // same booking, counted across the history. `<` on the person
    // expressions is what makes a pair unordered — of the two mirrored rows
    // it keeps one, and it drops the row pairing someone with themselves
    // along with it.
    //
    // Quadratic in the size of a booking but linear in their number, which
    // is the right way round: a booking holds a handful of people, and the
    // second copy is reached through `activity_booking_attendees_booking_user`,
    // which leads with the booking id. Names aren't selected — only the key
    // matters here, and the client resolves it against `attendance`.
    db
      .select({
        leftId: pairLeft.userId,
        leftName: pairLeft.name,
        rightId: pairRight.userId,
        rightName: pairRight.name,
        count,
      })
      .from(activityBookingsTable)
      .innerJoin(pairLeft, eq(pairLeft.bookingId, activityBookingsTable.id))
      .innerJoin(
        pairRight,
        and(eq(pairRight.bookingId, activityBookingsTable.id), sql`${leftPerson} < ${rightPerson}`),
      )
      .where(isPast)
      .groupBy(leftPerson, rightPerson),
  ]);

  return {
    /** Past bookings in total — the number each bar is read against. */
    bookings: bookingCountRows[0]?.count ?? 0,
    attendance: foldByName(attendanceRows, "guest"),
    locations: foldByName(locationRows, "free"),
    /** One entry per weekday/hour that was ever played, `weekday` being
     * ISO-8601 (1 = Monday). Hours with nothing in them are left out — the
     * grid they're drawn in fills its own blanks. */
    times: toHourCells(slotRows),
    /** One entry per pair of people who've been on a booking together, `a`
     * and `b` being keys from `attendance` above — the client resolves them
     * to names there rather than being sent every name a second time. */
    pairs: foldPairs(pairRows),
  };
};
