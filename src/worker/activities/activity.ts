import { and, eq, inArray, sql } from "drizzle-orm";

import { BASE_URL } from "../constants.ts";
import { createDb } from "../db/db.ts";
import {
  activitiesTable,
  activityAvailabilityTable,
  activityBookingAttendeesTable,
  activityBookingsTable,
  activityLocationsTable,
  type ActivitySlot,
  usersTable,
} from "../db/schema.ts";
import { postOrUpdateMessage } from "../slack/messages.ts";

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
            ? `👥 *Available (${params.responders.length})*\n${params.responders.join(", ")}`
            : "👥 _No responses yet._",
      },
    },
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
 * reflecting the current set of responses — edited in place via
 * `chat.update` once a post exists. No-ops for persistent activities, which
 * aren't announced this way. Call after creating the activity and again
 * whenever someone upserts their availability. */
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
    })
    .from(activityAvailabilityTable)
    .where(eq(activityAvailabilityTable.activityId, activityId));

  const responders = availabilityRows
    .filter((row) => row.slots.length > 0)
    .map((row) => {
      const days = new Set(row.slots.map((slot) => slot.date)).size;
      return `<@${row.userId}> (${days} day${days === 1 ? "" : "s"})`;
    });
  const decliners = availabilityRows.filter((row) => row.declined).map((row) => `<@${row.userId}>`);

  const { text, blocks } = buildActivitySuggestionMessage({
    title: activity.title,
    description: activity.description,
    suggestedDates: activity.suggestedDates,
    // Guaranteed non-null for a non-persistent activity — enforced by the
    // router's zod schema and the matching DB check constraint.
    endTime: activity.endTime!,
    responders,
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
  slots: ActivitySlot[];
  declined: boolean;
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
      suggestedDates: existing.persistent ? null : params.suggestedDates,
    })
    .where(eq(activitiesTable.id, params.activityId));

  await announceActivitySuggestion(env, params.activityId);

  return getActivityById(env, params.activityId);
};

export const getActivityById = async (env: Env, id: string) => {
  const db = createDb(env);

  const [activity] = await db.select().from(activitiesTable).where(eq(activitiesTable.id, id));

  return activity ?? null;
};

export const listActivitiesForChannel = async (env: Env, channelId: string, userId: string) => {
  const db = createDb(env);

  const rows = await db
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
      created: activitiesTable.created,
      slots: activityAvailabilityTable.slots,
      declined: activityAvailabilityTable.declined,
    })
    .from(activitiesTable)
    .leftJoin(
      activityAvailabilityTable,
      and(
        eq(activityAvailabilityTable.activityId, activitiesTable.id),
        eq(activityAvailabilityTable.userId, userId),
      ),
    )
    .where(and(eq(activitiesTable.channelId, channelId), eq(activitiesTable.archived, false)))
    .orderBy(activitiesTable.created);

  const activityIds = rows.map((row) => row.id);
  const availabilityRows = activityIds.length
    ? await db
        .select({
          activityId: activityAvailabilityTable.activityId,
          userId: activityAvailabilityTable.userId,
          name: usersTable.name,
          slots: activityAvailabilityTable.slots,
          declined: activityAvailabilityTable.declined,
        })
        .from(activityAvailabilityTable)
        .innerJoin(usersTable, eq(usersTable.userId, activityAvailabilityTable.userId))
        .where(inArray(activityAvailabilityTable.activityId, activityIds))
    : [];

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
    list.push({ userId: row.userId, name: row.name, slots: row.slots, declined: row.declined });
    responsesByActivity.set(row.activityId, list);
  }

  const locationRows = activityIds.length
    ? await db
        .select({
          id: activityLocationsTable.id,
          activityId: activityLocationsTable.activityId,
          name: activityLocationsTable.name,
          mapsUrl: activityLocationsTable.mapsUrl,
        })
        .from(activityLocationsTable)
        .where(
          and(
            inArray(activityLocationsTable.activityId, activityIds),
            eq(activityLocationsTable.archived, false),
          ),
        )
        .orderBy(activityLocationsTable.created)
    : [];

  const locationsByActivity = new Map<string, { id: string; name: string; mapsUrl: string }[]>();
  for (const row of locationRows) {
    const list = locationsByActivity.get(row.activityId) ?? [];
    list.push({ id: row.id, name: row.name, mapsUrl: row.mapsUrl });
    locationsByActivity.set(row.activityId, list);
  }

  const bookingRows = activityIds.length
    ? await db
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
          createdBy: activityBookingsTable.createdBy,
          createdByName: usersTable.name,
        })
        .from(activityBookingsTable)
        .innerJoin(usersTable, eq(usersTable.userId, activityBookingsTable.createdBy))
        // Left, and deliberately not filtered on `archived`: a booking that
        // used a since-retired place still shows where it was.
        .leftJoin(
          activityLocationsTable,
          eq(activityLocationsTable.id, activityBookingsTable.locationId),
        )
        .where(inArray(activityBookingsTable.activityId, activityIds))
    : [];

  const bookingIds = bookingRows.map((booking) => booking.id);
  const attendeeRows = bookingIds.length
    ? await db
        .select({
          bookingId: activityBookingAttendeesTable.bookingId,
          userId: activityBookingAttendeesTable.userId,
          // Members are named via the users join; guests carry their own
          // free-text name directly on the attendee row.
          name: sql<string>`coalesce(${usersTable.name}, ${activityBookingAttendeesTable.name})`,
        })
        .from(activityBookingAttendeesTable)
        .leftJoin(usersTable, eq(usersTable.userId, activityBookingAttendeesTable.userId))
        .where(inArray(activityBookingAttendeesTable.bookingId, bookingIds))
    : [];

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

  const bookedSlotsByActivity = new Map<string, Record<string, boolean>>();
  const bookingsByActivity = new Map<string, typeof bookingRows>();
  for (const booking of bookingRows) {
    const booked = bookedSlotsByActivity.get(booking.activityId) ?? {};
    booked[booking.date] = true;
    bookedSlotsByActivity.set(booking.activityId, booked);

    const list = bookingsByActivity.get(booking.activityId) ?? [];
    list.push(booking);
    bookingsByActivity.set(booking.activityId, list);
  }

  return rows.map((row) => ({
    ...row,
    slots: row.slots ?? [],
    declined: row.declined ?? false,
    responses: responsesByActivity.get(row.id) ?? [],
    locations: locationsByActivity.get(row.id) ?? [],
    bookedSlots: bookedSlotsByActivity.get(row.id) ?? {},
    bookings: (bookingsByActivity.get(row.id) ?? []).map((booking) => ({
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
            }
          : null,
      createdBy: booking.createdBy,
      createdByName: booking.createdByName,
      attendeeUserIds: attendeeIdsByBooking.get(booking.id) ?? [],
      guestNames: guestNamesByBooking.get(booking.id) ?? [],
      attendeeNames: attendeeNamesByBooking.get(booking.id) ?? [],
    })),
  }));
};
