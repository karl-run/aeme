import { eq } from "drizzle-orm";

import { createDb } from "../db/db.ts";
import { activityBookingAttendeesTable, activityBookingsTable } from "../db/schema.ts";
import { postMessage, updateMessage } from "../slack/messages.ts";

/** Builds the Slack `text` fallback + Block Kit `blocks` for a booking
 * announcement. Channel members are tagged via Slack's `<@userId>` mention
 * syntax (Slack resolves the display name/avatar itself, and it actually
 * pings them); guests with no Slack account are listed by plain name only —
 * never wrapped in `<@…>`, since that syntax only resolves for real Slack
 * user IDs. */
const buildBookingMessage = (params: {
  activityTitle: string;
  date: string;
  from: string;
  to: string;
  createdBy: string;
  attendeeUserIds: string[];
  guestNames: string[];
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
    {
      type: "section",
      text: { type: "mrkdwn", text: `👥 *Joining*\n${attendeeList}` },
    },
  ];

  return { text, blocks };
};

/** Posts (or edits, if `existingTs` is given) the Slack announcement for a
 * booking. Falls back to posting a fresh message if editing fails (e.g. the
 * original was deleted), storing the new `ts` either way. */
const announceBooking = async (
  env: Env,
  params: {
    bookingId: string;
    activityChannelId: string;
    existingTs: string | null;
    text: string;
    blocks: unknown[];
  },
) => {
  if (params.existingTs) {
    const updated = await updateMessage(env, {
      channel: params.activityChannelId,
      ts: params.existingTs,
      text: params.text,
      blocks: params.blocks,
    });
    if (updated) return;
  }

  const posted = await postMessage(env, {
    channel: params.activityChannelId,
    text: params.text,
    blocks: params.blocks,
  });
  if (posted) {
    const db = createDb(env);
    await db
      .update(activityBookingsTable)
      .set({ slackMessageTs: posted.ts })
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

export const createBooking = async (
  env: Env,
  params: {
    activityId: string;
    activityTitle: string;
    activityChannelId: string;
    createdBy: string;
    date: string;
    from: string;
    to: string;
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
    activityTitle: params.activityTitle,
    date: params.date,
    from: params.from,
    to: params.to,
    createdBy: params.createdBy,
    attendeeUserIds: params.attendeeUserIds,
    guestNames: params.guestNames,
  });
  await announceBooking(env, {
    bookingId,
    activityChannelId: params.activityChannelId,
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
    createdBy: string;
    date: string;
    from: string;
    to: string;
    attendeeUserIds: string[];
    guestNames: string[];
    slackMessageTs: string | null;
  },
) => {
  const db = createDb(env);

  const bookingUpdate = db
    .update(activityBookingsTable)
    .set({ date: params.date, from: params.from, to: params.to })
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
    activityTitle: params.activityTitle,
    date: params.date,
    from: params.from,
    to: params.to,
    createdBy: params.createdBy,
    attendeeUserIds: params.attendeeUserIds,
    guestNames: params.guestNames,
  });
  await announceBooking(env, {
    bookingId: params.bookingId,
    activityChannelId: params.activityChannelId,
    existingTs: params.slackMessageTs,
    text,
    blocks,
  });
};
