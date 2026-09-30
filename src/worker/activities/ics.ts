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
  date: string;
  from: string;
  to: string;
  description: string;
  location: string;
}) => {
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

  if (params.description) lines.push(`DESCRIPTION:${escapeIcsText(params.description)}`);
  if (params.location) lines.push(`LOCATION:${escapeIcsText(params.location)}`);

  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
};
