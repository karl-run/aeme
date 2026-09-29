import { eq } from "drizzle-orm";

import { createDb } from "../db/db.ts";
import { activityBookingAttendeesTable, activityBookingsTable } from "../db/schema.ts";
import { postMessage } from "../slack/messages.ts";

/** Builds the Slack `text` fallback + Block Kit `blocks` for a booking
 * announcement. Attendees (and the creator) are tagged via Slack's `<@userId>`
 * mention syntax — Slack resolves the display name/avatar itself, so no name
 * lookup is needed here, and it also actually pings each person. */
const buildBookingMessage = (params: {
  activityTitle: string;
  date: string;
  from: string;
  to: string;
  createdBy: string;
  attendeeUserIds: string[];
}) => {
  const formattedDate = new Date(`${params.date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const attendeeList =
    params.attendeeUserIds.length > 0
      ? params.attendeeUserIds.map((userId) => `• <@${userId}>`).join("\n")
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
    db.insert(activityBookingAttendeesTable).values({ id: crypto.randomUUID(), bookingId, userId }),
  );

  await db.batch([bookingInsert, ...attendeeInserts]);

  const { text, blocks } = buildBookingMessage({
    activityTitle: params.activityTitle,
    date: params.date,
    from: params.from,
    to: params.to,
    createdBy: params.createdBy,
    attendeeUserIds: params.attendeeUserIds,
  });
  const posted = await postMessage(env, { channel: params.activityChannelId, text, blocks });

  if (posted) {
    await db
      .update(activityBookingsTable)
      .set({ slackMessageTs: posted.ts })
      .where(eq(activityBookingsTable.id, bookingId));
  }

  return { id: bookingId };
};
