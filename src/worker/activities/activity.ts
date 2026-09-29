import { and, eq, inArray } from "drizzle-orm";

import { createDb } from "../db/db.ts";
import {
  activitiesTable,
  activityAvailabilityTable,
  activityBookingAttendeesTable,
  activityBookingsTable,
  type ActivitySlot,
  usersTable,
} from "../db/schema.ts";

/** Key for a slot in an `othersCount` map: the date alone for day-granularity
 * activities, or `date|hour` per hour covered by an hourly slot. */
const slotCountKeys = (slot: ActivitySlot): string[] => {
  if (!slot.from || !slot.to) return [slot.date];

  const fromHour = Number(slot.from.slice(0, 2));
  const toHour = Number(slot.to.slice(0, 2));
  return Array.from({ length: toHour - fromHour }, (_, i) => `${slot.date}|${fromHour + i}`);
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
          name: usersTable.name,
        })
        .from(activityBookingAttendeesTable)
        .innerJoin(usersTable, eq(usersTable.userId, activityBookingAttendeesTable.userId))
        .where(inArray(activityBookingAttendeesTable.bookingId, bookingIds))
    : [];

  const attendeeNamesByBooking = new Map<string, string[]>();
  for (const row of attendeeRows) {
    const names = attendeeNamesByBooking.get(row.bookingId) ?? [];
    names.push(row.name);
    attendeeNamesByBooking.set(row.bookingId, names);
  }

  const bookedSlotsByActivity = new Map<string, Record<string, boolean>>();
  const bookingsByActivity = new Map<string, typeof bookingRows>();
  for (const booking of bookingRows) {
    const booked = bookedSlotsByActivity.get(booking.activityId) ?? {};
    for (const key of slotCountKeys(booking)) booked[key] = true;
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
      createdByName: booking.createdByName,
      attendeeNames: attendeeNamesByBooking.get(booking.id) ?? [],
    })),
  }));
};
