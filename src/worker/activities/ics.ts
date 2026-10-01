/** RFC 5545 requires long lines folded at 75 octets, with continuation
 * lines starting with a space. Most calendar apps tolerate unfolded lines,
 * but descriptions can get long, so fold properly for compatibility. */
const foldIcsLine = (line: string): string => {
  if (line.length <= 75) return line;

  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  parts.push(rest);
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

export const buildBookingIcs = (params: {
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
   * along in LOCATION, which most calendar apps linkify. */
  fixedLocation: { name: string; mapsUrl: string } | null;
  createdByName: string;
  /** Members and guests alike, already resolved to display names. They go in
   * the description rather than as ATTENDEE properties: that field takes a
   * CAL-ADDRESS, and æme knows people by Slack id and name, never by email —
   * inventing mailto: addresses would be worse than plain text. */
  attendeeNames: string[];
  /** Advisory headcount, rendered as "3/4" when set. */
  idealMemberCount: number | null;
}) => {
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

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//aeme//booking//EN",
    "BEGIN:VEVENT",
    `UID:${params.bookingId}@aeme.karl.run`,
    `DTSTAMP:${toIcsTimestamp(params.created)}`,
    `DTSTART:${toIcsDateTime(params.date, params.from)}`,
    `DTEND:${toIcsDateTime(params.date, params.to)}`,
    `SUMMARY:${escapeIcsText(params.activityTitle)}`,
  ];

  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  if (locationText) lines.push(`LOCATION:${escapeIcsText(locationText)}`);

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
};
