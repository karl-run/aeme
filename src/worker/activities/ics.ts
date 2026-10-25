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

/** `date` is YYYY-MM-DD, `time` is HH:MM — both local wall-clock values with
 * no stored timezone, so they're emitted as RFC 5545 "floating" time (no `Z`
 * suffix, no `TZID`): the receiving calendar app interprets them in whatever
 * timezone it's already in, which matches how they were entered. */
const toIcsDateTime = (date: string, time: string) =>
  `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

const toIcsTimestamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d+/, "");

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
 * file and the Google Calendar link so both say the same thing. */
const buildBookingEventFields = (params: BookingEventParams) => {
  const locationText = params.fixedLocation
    ? `${params.fixedLocation.name}, ${params.fixedLocation.mapsUrl}`
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

/** Google Calendar's "create event" template URL. Times are passed without a
 * `Z` suffix or `ctz`, which Google interprets in the user's own calendar
 * timezone — the same floating-time semantics as the ICS. */
export const buildBookingGoogleCalendarUrl = (params: BookingEventParams) => {
  const { description, locationText } = buildBookingEventFields(params);
  // Google matches the location *text* against Maps places and doesn't follow
  // links, so a fixed location passes just its name (which Google can tag)
  // and its maps link moves into the details instead. The Maps spelling wins
  // when it's set, since "the usual court" matches no place on the map.
  const location = params.fixedLocation
    ? (params.fixedLocation.mapsPlaceName ?? params.fixedLocation.name)
    : locationText;
  const details = params.fixedLocation
    ? [description, `Map: ${params.fixedLocation.mapsUrl}`].filter(Boolean).join("\n\n")
    : description;

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", params.activityTitle);
  url.searchParams.set(
    "dates",
    `${toIcsDateTime(params.date, params.from)}/${toIcsDateTime(params.date, params.to)}`,
  );
  if (details) url.searchParams.set("details", details);
  if (location) url.searchParams.set("location", location);
  return url.toString();
};
