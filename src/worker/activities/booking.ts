import { eq, sql } from "drizzle-orm";

import { BASE_URL } from "../constants.ts";
import { createDb } from "../db/db.ts";
import { activityBookingAttendeesTable, activityBookingsTable, usersTable } from "../db/schema.ts";
import { deleteMessage, postOrUpdateMessage } from "../slack/messages.ts";

/** Builds the Slack `text` fallback + Block Kit `blocks` for a booking
 * announcement. Channel members are tagged via Slack's `<@userId>` mention
 * syntax (Slack resolves the display name/avatar itself, and it actually
 * pings them); guests with no Slack account are listed by plain name only —
 * never wrapped in `<@…>`, since that syntax only resolves for real Slack
 * user IDs. */
const isUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

/** A place picked from the activity's fixed locations, already resolved by
 * the caller — null when the booking carries free text (or nothing) instead. */
type FixedLocation = { name: string; mapsUrl: string } | null;

/** Slack mrkdwn link syntax is `<url|label>`, so a label carrying any of
 * `<`, `>` or `|` would break out of it. */
const sanitizeLinkLabel = (label: string) => label.replace(/[<>|]/g, " ");

const buildBookingMessage = (params: {
  bookingId: string;
  activityTitle: string;
  date: string;
  from: string;
  to: string;
  createdBy: string;
  attendeeUserIds: string[];
  guestNames: string[];
  description: string;
  location: string;
  fixedLocation: FixedLocation;
}) => {
  const formattedDate = new Date(`${params.date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const attendeeEntries = [
    ...params.attendeeUserIds.map((userId) => `<@${userId}>`),
    ...params.guestNames,
  ];
  const attendeeList =
    attendeeEntries.length > 0
      ? attendeeEntries.map((entry) => `• ${entry}`).join("\n")
      : "_No one else joining yet._";

  const text = `📅 New booking for ${params.activityTitle}: ${formattedDate} · ${params.from}–${params.to}`;

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `📅 ${params.activityTitle}`, emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${formattedDate}* · ${params.from}–${params.to}\n🙋 Booked by <@${params.createdBy}>`,
      },
    },
    ...(params.description
      ? [{ type: "section", text: { type: "mrkdwn", text: `📝 ${params.description}` } }]
      : []),
    ...(params.fixedLocation || params.location
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: params.fixedLocation
                ? `📍 <${params.fixedLocation.mapsUrl}|${sanitizeLinkLabel(params.fixedLocation.name)}>`
                : isUrl(params.location)
                  ? `📍 <${params.location}|Location>`
                  : `📍 ${params.location}`,
            },
          },
        ]
      : []),
    {
      type: "section",
      text: { type: "mrkdwn", text: `👥 *Joining*\n${attendeeList}` },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `🗓️ <${BASE_URL}/api/bookings/${params.bookingId}/ics|Add to calendar>`,
        },
      ],
    },
  ];

  return { text, blocks };
};

/** Posts (or edits, if `existingTs` is given) the Slack announcement for a
 * booking. A one-off activity's booking is posted as a broadcasted reply in
 * its suggestion thread (`activityThreadTs`, see `activity.slackMessageTs`)
 * rather than top-level — a persistent activity has no suggestion post, so
 * `activityThreadTs` is null and it posts top-level like before. */
const announceBooking = async (
  env: Env,
  params: {
    bookingId: string;
    activityChannelId: string;
    activityThreadTs: string | null;
    existingTs: string | null;
    text: string;
    blocks: unknown[];
  },
) => {
  const ts = await postOrUpdateMessage(env, {
    channel: params.activityChannelId,
    existingTs: params.existingTs,
    text: params.text,
    blocks: params.blocks,
    thread_ts: params.activityThreadTs ?? undefined,
    reply_broadcast: params.activityThreadTs !== null,
  });

  if (ts) {
    const db = createDb(env);
    await db
      .update(activityBookingsTable)
      .set({ slackMessageTs: ts })
      .where(eq(activityBookingsTable.id, params.bookingId));
  }
};

export const getBookingById = async (env: Env, id: string) => {
  const db = createDb(env);

  const [booking] = await db
    .select()
    .from(activityBookingsTable)
    .where(eq(activityBookingsTable.id, id));

  return booking ?? null;
};

/** Display names of a booking's attendees — channel members resolved through
 * `users`, guests carrying their own name on the attendee row. Mirrors the
 * shaping `listActivitiesForChannel` does, for callers that have a booking id
 * and nothing else (the session-less ICS route). */
export const listBookingAttendeeNames = async (env: Env, bookingId: string): Promise<string[]> => {
  const db = createDb(env);

  const rows = await db
    .select({
      name: sql<string>`coalesce(${usersTable.name}, ${activityBookingAttendeesTable.name})`,
    })
    .from(activityBookingAttendeesTable)
    .leftJoin(usersTable, eq(usersTable.userId, activityBookingAttendeesTable.userId))
    .where(eq(activityBookingAttendeesTable.bookingId, bookingId));

  return rows.map((row) => row.name);
};

export const createBooking = async (
  env: Env,
  params: {
    activityId: string;
    activityTitle: string;
    activityChannelId: string;
    activityThreadTs: string | null;
    createdBy: string;
    date: string;
    from: string;
    to: string;
    description: string;
    location: string;
    locationId: string | null;
    fixedLocation: FixedLocation;
    attendeeUserIds: string[];
    guestNames: string[];
  },
) => {
  const db = createDb(env);

  const bookingId = crypto.randomUUID();
  const now = new Date().toISOString();

  const bookingInsert = db.insert(activityBookingsTable).values({
    id: bookingId,
    activityId: params.activityId,
    createdBy: params.createdBy,
    date: params.date,
    from: params.from,
    to: params.to,
    description: params.description,
    location: params.location,
    locationId: params.locationId,
    created: now,
  });
  const attendeeInserts = params.attendeeUserIds.map((userId) =>
    db
      .insert(activityBookingAttendeesTable)
      .values({ id: crypto.randomUUID(), bookingId, userId, name: null }),
  );
  const guestInserts = params.guestNames.map((name) =>
    db
      .insert(activityBookingAttendeesTable)
      .values({ id: crypto.randomUUID(), bookingId, userId: null, name }),
  );

  await db.batch([bookingInsert, ...attendeeInserts, ...guestInserts]);

  const { text, blocks } = buildBookingMessage({
    bookingId,
    activityTitle: params.activityTitle,
    date: params.date,
    from: params.from,
    to: params.to,
    createdBy: params.createdBy,
    attendeeUserIds: params.attendeeUserIds,
    guestNames: params.guestNames,
    description: params.description,
    location: params.location,
    fixedLocation: params.fixedLocation,
  });
  await announceBooking(env, {
    bookingId,
    activityChannelId: params.activityChannelId,
    activityThreadTs: params.activityThreadTs,
    existingTs: null,
    text,
    blocks,
  });

  return { id: bookingId };
};

export const updateBooking = async (
  env: Env,
  params: {
    bookingId: string;
    activityTitle: string;
    activityChannelId: string;
    activityThreadTs: string | null;
    createdBy: string;
    date: string;
    from: string;
    to: string;
    description: string;
    location: string;
    locationId: string | null;
    fixedLocation: FixedLocation;
    attendeeUserIds: string[];
    guestNames: string[];
    slackMessageTs: string | null;
  },
) => {
  const db = createDb(env);

  const bookingUpdate = db
    .update(activityBookingsTable)
    .set({
      date: params.date,
      from: params.from,
      to: params.to,
      description: params.description,
      location: params.location,
      locationId: params.locationId,
    })
    .where(eq(activityBookingsTable.id, params.bookingId));
  const attendeeDelete = db
    .delete(activityBookingAttendeesTable)
    .where(eq(activityBookingAttendeesTable.bookingId, params.bookingId));
  const attendeeInserts = params.attendeeUserIds.map((userId) =>
    db.insert(activityBookingAttendeesTable).values({
      id: crypto.randomUUID(),
      bookingId: params.bookingId,
      userId,
      name: null,
    }),
  );
  const guestInserts = params.guestNames.map((name) =>
    db.insert(activityBookingAttendeesTable).values({
      id: crypto.randomUUID(),
      bookingId: params.bookingId,
      userId: null,
      name,
    }),
  );

  await db.batch([bookingUpdate, attendeeDelete, ...attendeeInserts, ...guestInserts]);

  const { text, blocks } = buildBookingMessage({
    bookingId: params.bookingId,
    activityTitle: params.activityTitle,
    date: params.date,
    from: params.from,
    to: params.to,
    createdBy: params.createdBy,
    attendeeUserIds: params.attendeeUserIds,
    guestNames: params.guestNames,
    description: params.description,
    location: params.location,
    fixedLocation: params.fixedLocation,
  });
  await announceBooking(env, {
    bookingId: params.bookingId,
    activityChannelId: params.activityChannelId,
    activityThreadTs: params.activityThreadTs,
    existingTs: params.slackMessageTs,
    text,
    blocks,
  });
};

/** Removes a booking, its attendees, and the Slack post announcing it. Only
 * the booking's creator may call this (enforced by the router).
 *
 * The rows go first and the Slack delete is best-effort afterwards, matching
 * how every other Slack call here behaves: an outage leaves a stale post
 * rather than a booking the UI claims is gone. The post is a notification,
 * the row is the record. */
export const deleteBooking = async (
  env: Env,
  params: { bookingId: string; channelId: string; slackMessageTs: string | null },
) => {
  const db = createDb(env);

  await db.batch([
    db
      .delete(activityBookingAttendeesTable)
      .where(eq(activityBookingAttendeesTable.bookingId, params.bookingId)),
    db.delete(activityBookingsTable).where(eq(activityBookingsTable.id, params.bookingId)),
  ]);

  if (params.slackMessageTs) {
    await deleteMessage(env, { channel: params.channelId, ts: params.slackMessageTs });
  }
};
