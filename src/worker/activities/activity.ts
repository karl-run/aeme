import { and, eq, inArray, sql } from "drizzle-orm";

import { createDb } from "../db/db.ts";
import {
  activitiesTable,
  activityAvailabilityTable,
  activityBookingAttendeesTable,
  activityBookingsTable,
  type ActivitySlot,
  usersTable,
} from "../db/schema.ts";

const timeToMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Key for an availability slot in an `othersCount` map: the date alone for
 * day-granularity activities, or `date|hour` per hour cell the slot's
 * from/to range overlaps for an hourly slot. */
const slotCountKeys = (slot: ActivitySlot): string[] => {
  if (!slot.from || !slot.to) return [slot.date];

  const startHour = Math.floor(timeToMinutes(slot.from) / 60);
  const endHourExclusive = Math.ceil(timeToMinutes(slot.to) / 60);
  return Array.from(
    { length: Math.max(0, endHourExclusive - startHour) },
    (_, i) => `${slot.date}|${startHour + i}`,
  );
};

export const createActivity = async (
  env: Env,
  params: {
    channelId: string;
    title: string;
    description: string;
    endTime: string | null;
    persistent: boolean;
    slotGranularity: "day" | "hourly";
    suggestedDates: string[] | null;
  },
) => {
  const db = createDb(env);

  const [activity] = await db
    .insert(activitiesTable)
    .values({
      id: crypto.randomUUID(),
      channelId: params.channelId,
      title: params.title,
      description: params.description,
      endTime: params.persistent ? null : params.endTime,
      persistent: params.persistent,
      slotGranularity: params.slotGranularity,
      suggestedDates: params.persistent ? null : params.suggestedDates,
      archived: false,
      created: new Date().toISOString(),
    })
    .returning();

  return activity;
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
      title: activitiesTable.title,
      description: activitiesTable.description,
      endTime: activitiesTable.endTime,
      persistent: activitiesTable.persistent,
      slotGranularity: activitiesTable.slotGranularity,
      suggestedDates: activitiesTable.suggestedDates,
      created: activitiesTable.created,
      slots: activityAvailabilityTable.slots,
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
  const othersAvailability = activityIds.length
    ? await db
        .select({
          activityId: activityAvailabilityTable.activityId,
          userId: activityAvailabilityTable.userId,
          slots: activityAvailabilityTable.slots,
        })
        .from(activityAvailabilityTable)
        .where(inArray(activityAvailabilityTable.activityId, activityIds))
    : [];

  const othersCountByActivity = new Map<string, Record<string, number>>();
  for (const row of othersAvailability) {
    if (row.userId === userId) continue;

    const counts = othersCountByActivity.get(row.activityId) ?? {};
    for (const slot of row.slots) {
      for (const key of slotCountKeys(slot)) counts[key] = (counts[key] ?? 0) + 1;
    }
    othersCountByActivity.set(row.activityId, counts);
  }

  const bookingRows = activityIds.length
    ? await db
        .select({
          id: activityBookingsTable.id,
          activityId: activityBookingsTable.activityId,
          date: activityBookingsTable.date,
          from: activityBookingsTable.from,
          to: activityBookingsTable.to,
          createdBy: activityBookingsTable.createdBy,
          createdByName: usersTable.name,
        })
        .from(activityBookingsTable)
        .innerJoin(usersTable, eq(usersTable.userId, activityBookingsTable.createdBy))
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
    othersCount: othersCountByActivity.get(row.id) ?? {},
    bookedSlots: bookedSlotsByActivity.get(row.id) ?? {},
    bookings: (bookingsByActivity.get(row.id) ?? []).map((booking) => ({
      id: booking.id,
      date: booking.date,
      from: booking.from,
      to: booking.to,
      createdBy: booking.createdBy,
      createdByName: booking.createdByName,
      attendeeUserIds: attendeeIdsByBooking.get(booking.id) ?? [],
      guestNames: guestNamesByBooking.get(booking.id) ?? [],
      attendeeNames: attendeeNamesByBooking.get(booking.id) ?? [],
    })),
  }));
};
