import { createDb } from "../db/db.ts";
import { activityBookingAttendeesTable, activityBookingsTable } from "../db/schema.ts";

export const createBooking = async (
  env: Env,
  params: {
    activityId: string;
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

  return { id: bookingId };
};
