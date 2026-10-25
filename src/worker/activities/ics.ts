import { utcInstantFromDisplayZone } from "../dates.ts";

const MAX_LINE_OCTETS = 75;

const utf8 = new TextEncoder();
const octetLength = (value: string) => utf8.encode(value).length;

/** RFC 5545 requires long lines folded at 75 octets, with continuation
 * lines starting with a space. Most calendar apps tolerate unfolded lines,
 * but descriptions can get long, so fold properly for compatibility.
 *
 * Octets, not characters: a description full of Norwegian is two bytes per
 * vowel, and slicing by string index would both overshoot the limit and —
 * for anything outside the BMP, an emoji in a booking note being the way
 * that actually happens — cut a surrogate pair in half and put invalid UTF-8
 * on the wire. Iterating the string yields whole code points, so a character
 * moves to the next line intact. The leading space counts toward the
 * continuation line's own 75. */
const foldIcsLine = (line: string): string => {
  if (octetLength(line) <= MAX_LINE_OCTETS) return line;

  const parts: string[] = [];
  let current = "";
  let currentOctets = 0;

  for (const char of line) {
    const size = octetLength(char);
    if (currentOctets + size > MAX_LINE_OCTETS) {
      parts.push(current);
      current = " ";
      currentOctets = 1;
    }
    current += char;
    currentOctets += size;
  }

  parts.push(current);
  return parts.join("\r\n");
};

/** Escapes a TEXT value per RFC 5545: backslash, comma, semicolon, and
 * newlines all need escaping inside a property value. */
const escapeIcsText = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");

const toIcsTimestamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d+/, "");

/** `date` is YYYY-MM-DD and `time` is HH:MM, both stored as the wall clock
 * someone typed in Oslo with no zone attached — so they're resolved to the
 * instant they actually name and emitted as UTC, with the `Z` suffix.
 *
 * These used to go out as RFC 5545 "floating" time (no `Z`, no `TZID`), on
 * the reading that a client interprets floating time in whatever zone it's
 * already in. Google doesn't: a subscribed feed's floating times are taken
 * as UTC, which put every event in the calendar out by Oslo's offset — two
 * hours through the summer, one after the October switch. UTC instants are
 * what every client agrees on, and they need no `VTIMEZONE` to go with
 * them. */
const toIcsDateTime = (date: string, time: string) =>
  toIcsTimestamp(utcInstantFromDisplayZone(date, time).toISOString());

export type BookingEventParams = {
  bookingId: string;
  created: string;
  activityTitle: string;
  /** The activity's standing blurb, which applies to every booking of it — as
   * opposed to `description`, this occurrence's own note. Both go into
   * DESCRIPTION, since a calendar event has only the one field. */
  activityDescription: string;
  date: string;
  from: string;
  to: string;
  description: string;
  location: string;
  /** A place picked from the activity's fixed locations; its maps link rides
   * along in LOCATION, which most calendar apps linkify. `mapsPlaceName` is
   * the spelling Google Maps knows it by, when the activity's own name for it
   * isn't one Maps would match. */
  fixedLocation: { name: string; mapsUrl: string; mapsPlaceName: string | null } | null;
  createdByName: string;
  /** Members and guests alike, already resolved to display names. They go in
   * the description rather than as ATTENDEE properties: that field takes a
   * CAL-ADDRESS, and æme knows people by Slack id and name, never by email —
   * inventing mailto: addresses would be worse than plain text. */
  attendeeNames: string[];
  /** Advisory headcount, rendered as "3/4" when set. */
  idealMemberCount: number | null;
};

/** The human-facing fields of a booking's calendar event, shared by the ICS
 * file, the subscription feed and the Google Calendar link so a booking says
 * the same thing whichever way it reaches a calendar.
 *
 * `LOCATION` is matched against the map as *text* — neither Google nor Apple
 * follows a link in it — so a fixed location passes the name the map knows
 * it by, falling back to the channel's own name for the place, and its maps
 * link moves into the description, where it stays clickable. A `LOCATION`
 * with a URL in it geocodes to nothing, which costs the event its pin and
 * its directions button: the one thing worth having from a calendar while
 * standing outside the wrong building. */
const buildBookingEventFields = (params: BookingEventParams) => {
  const locationText = params.fixedLocation
    ? (params.fixedLocation.mapsPlaceName ?? params.fixedLocation.name)
    : params.location;

  const count = params.idealMemberCount
    ? `${params.attendeeNames.length}/${params.idealMemberCount}`
    : `${params.attendeeNames.length}`;
  const joining =
    params.attendeeNames.length > 0
      ? `Joining (${count}): ${params.attendeeNames.join(", ")}`
      : "No one else joining yet.";

  const description = [
    params.activityDescription,
    params.description,
    [joining, `Booked by ${params.createdByName}`].join("\n"),
    params.fixedLocation ? `Map: ${params.fixedLocation.mapsUrl}` : "",
  ]
    .filter((part) => part !== "")
    .join("\n\n");

  return { description, locationText };
};

/** One booking as a VEVENT, shared by the single-event download and the
 * subscription feed so a booking reads the same either way. The UID is the
 * booking's own id, which is what lets a subscribed calendar recognise an
 * event it already has and update it in place instead of adding a second
 * copy on every refetch. */
const buildBookingVevent = (params: BookingEventParams) => {
  const { description, locationText } = buildBookingEventFields(params);

  const lines = [
    "BEGIN:VEVENT",
    `UID:${params.bookingId}@aeme.karl.run`,
    `DTSTAMP:${toIcsTimestamp(params.created)}`,
    `DTSTART:${toIcsDateTime(params.date, params.from)}`,
    `DTEND:${toIcsDateTime(params.date, params.to)}`,
    `SUMMARY:${escapeIcsText(params.activityTitle)}`,
  ];

  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  if (locationText) lines.push(`LOCATION:${escapeIcsText(locationText)}`);

  lines.push("END:VEVENT");

  return lines;
};

const wrapVcalendar = (lines: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//aeme//booking//EN", ...lines, "END:VCALENDAR"]
    .map(foldIcsLine)
    .join("\r\n") + "\r\n";

export const buildBookingIcs = (params: BookingEventParams) =>
  wrapVcalendar(buildBookingVevent(params));

/** The whole subscription feed: every booking the subscriber is on, in one
 * document that replaces their calendar's copy of it on each fetch. A booking
 * they've been taken off — or that was deleted outright — is simply absent
 * from the next fetch, which is how a subscribed calendar is told to drop it;
 * no cancellation tombstone is needed.
 *
 * `METHOD:PUBLISH` marks this as a published calendar rather than an
 * invitation, so clients render it read-only instead of offering to RSVP on
 * the subscriber's behalf. The two refresh hints ask for hourly polling —
 * Apple and Outlook take some notice of them, Google ignores them and polls
 * on its own schedule. */
export const buildCalendarFeedIcs = (
  events: BookingEventParams[],
  params: { calendarName: string },
) =>
  wrapVcalendar([
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(params.calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events.flatMap(buildBookingVevent),
  ]);

/** Google Calendar's "create event" template URL. `dates` carries the same
 * UTC instants the ICS does, `Z` suffix and all, so the form opens on the
 * right hour whatever timezone the person filling it in is sitting in. */
export const buildBookingGoogleCalendarUrl = (params: BookingEventParams) => {
  // Same two fields the ICS carries — the place as text Maps can tag, the
  // link to it in the details — which is now where that rule lives.
  const { description, locationText } = buildBookingEventFields(params);

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", params.activityTitle);
  url.searchParams.set(
    "dates",
    `${toIcsDateTime(params.date, params.from)}/${toIcsDateTime(params.date, params.to)}`,
  );
  if (description) url.searchParams.set("details", description);
  if (locationText) url.searchParams.set("location", locationText);
  return url.toString();
};
