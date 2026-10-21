import { TicketIcon } from "lucide-react";

import type { ActivityWithAvailability } from "../queries/activities.ts";

type Props = {
  locations: ActivityWithAvailability["locations"];
};

/** Straight-out links to the places' own reservation pages, for the activity's
 * locations that have one — booking here says who's coming, the court still
 * has to be booked with the venue. Kept to a line of small text under the
 * upcoming bookings: a shortcut, not a section of its own. Renders nothing
 * when no location has a booking URL. */
export const BookableLocationLinks = ({ locations }: Props) => {
  // flatMap rather than filter, so `bookingUrl` narrows to a string.
  const bookable = locations.flatMap((location) =>
    location.bookingUrl
      ? [{ id: location.id, name: location.name, bookingUrl: location.bookingUrl }]
      : [],
  );

  if (bookable.length === 0) return null;

  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
      {bookable.map((location) => (
        <a
          key={location.id}
          href={location.bookingUrl}
          target="_blank"
          rel="noreferrer"
          title={`Book ${location.name}`}
          className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          <TicketIcon className="size-3 shrink-0" />
          <span className="truncate">{location.name}</span>
        </a>
      ))}
    </div>
  );
};
