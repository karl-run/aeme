import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { createDb } from "../db/db.ts";
import {
  activitiesTable,
  activityBookingAttendeesTable,
  activityBookingsTable,
  activityLocationsTable,
  usersTable,
} from "../db/schema.ts";
import type { BookingEventParams } from "./ics.ts";

/** How far back the feed reaches. A calendar that starts at today looks
 * broken when you scroll up through the week you're in, and a subscriber
 * glancing at last month expects to still see what they went to — but the
 * whole history would be re-sent on every poll forever, so it stops here. */
const FEED_PAST_DAYS = 60;

/** A ceiling on one fetch, so a feed can't grow without bound no matter how
 * much someone books. Far above what `FEED_PAST_DAYS` of a real channel
 * produces; it exists to bound the response, not to shape it. */
const FEED_MAX_EVENTS = 500;

const feedCutoffDate = () =>
  new Date(Date.now() - FEED_PAST_DAYS * 86_400_000).toISOString().slice(0, 10);

/** Every booking `userId` is an attendee of, as calendar events — across all
 * their channels, since a subscription is per person rather than per channel
 * and their calendar app has no way to switch between them.
 *
 * Attendance is the filter, not channel membership: bookings in their
 * channels that they aren't on belong on the æme calendar page, not in their
 * own calendar. Archived activities drop out with their bookings.
 *
 * Two statements, batched: the second takes the first's `where` as a
 * subquery rather than ids read back over a round trip, the same shape as
 * `listChannelBookingsInRange`. */
export const listSubscriberBookingEvents = async (
  env: Env,
  userId: string,
): Promise<BookingEventParams[]> => {
  const db = createDb(env);

  const attendedBookingIds = db
    .select({ id: activityBookingAttendeesTable.bookingId })
    .from(activityBookingAttendeesTable)
    .where(eq(activityBookingAttendeesTable.userId, userId));

  const inFeed = and(
    inArray(activityBookingsTable.id, attendedBookingIds),
    gte(activityBookingsTable.date, feedCutoffDate()),
    eq(activitiesTable.archived, false),
  );

  const feedBookingIds = db
    .select({ id: activityBookingsTable.id })
    .from(activityBookingsTable)
    .innerJoin(activitiesTable, eq(activitiesTable.id, activityBookingsTable.activityId))
    .where(inFeed)
    .limit(FEED_MAX_EVENTS);

  const [bookingRows, attendeeRows] = await db.batch([
    db
      .select({
        id: activityBookingsTable.id,
        created: activityBookingsTable.created,
        date: activityBookingsTable.date,
        from: activityBookingsTable.from,
        to: activityBookingsTable.to,
        description: activityBookingsTable.description,
        location: activityBookingsTable.location,
        activityTitle: activitiesTable.title,
        activityDescription: activitiesTable.description,
        idealMemberCount: activitiesTable.idealMemberCount,
        locationId: activityBookingsTable.locationId,
        locationName: activityLocationsTable.name,
        locationMapsUrl: activityLocationsTable.mapsUrl,
        locationMapsPlaceName: activityLocationsTable.mapsPlaceName,
        createdByName: usersTable.name,
      })
      .from(activityBookingsTable)
      .innerJoin(activitiesTable, eq(activitiesTable.id, activityBookingsTable.activityId))
      .innerJoin(usersTable, eq(usersTable.userId, activityBookingsTable.createdBy))
      .leftJoin(
        activityLocationsTable,
        eq(activityLocationsTable.id, activityBookingsTable.locationId),
      )
      .where(inFeed)
      .limit(FEED_MAX_EVENTS),
    db
      .select({
        bookingId: activityBookingAttendeesTable.bookingId,
        name: sql<string>`coalesce(${usersTable.name}, ${activityBookingAttendeesTable.name})`,
      })
      .from(activityBookingAttendeesTable)
      .leftJoin(usersTable, eq(usersTable.userId, activityBookingAttendeesTable.userId))
      .where(inArray(activityBookingAttendeesTable.bookingId, feedBookingIds)),
  ]);

  const attendeeNamesByBooking = new Map<string, string[]>();
  for (const row of attendeeRows) {
    const names = attendeeNamesByBooking.get(row.bookingId) ?? [];
    names.push(row.name);
    attendeeNamesByBooking.set(row.bookingId, names);
  }

  return bookingRows.map((booking) => ({
    bookingId: booking.id,
    created: booking.created,
    activityTitle: booking.activityTitle,
    activityDescription: booking.activityDescription,
    date: booking.date,
    from: booking.from,
    to: booking.to,
    description: booking.description,
    location: booking.location,
    fixedLocation:
      booking.locationId && booking.locationName && booking.locationMapsUrl
        ? {
            name: booking.locationName,
            mapsUrl: booking.locationMapsUrl,
            mapsPlaceName: booking.locationMapsPlaceName,
          }
        : null,
    createdByName: booking.createdByName,
    attendeeNames: attendeeNamesByBooking.get(booking.id) ?? [],
    idealMemberCount: booking.idealMemberCount,
  }));
};
