import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { InfoIcon } from "lucide-react";

import { isUrl } from "../lib/is-url.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";
import { useSessionQuery } from "../queries/session.ts";
import { Button } from "./ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";

type BookingSummary = ActivityWithAvailability["bookings"][number];

type Props = {
  activityId: string;
  bookings: BookingSummary[];
  className?: string;
  /** Advisory headcount, shown alongside the attendee count as "N/ideal". */
  idealMemberCount?: number | null;
  /** Where the edit link should return to once it's done. */
  from: "home" | "activity";
};

export const BookingInfoPopover = ({
  activityId,
  bookings,
  className,
  idealMemberCount,
  from,
}: Props) => {
  const { data } = useSessionQuery();
  const userId = data?.session?.userId;

  if (bookings.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Booking details"
            className={cn(
              "pointer-events-auto flex size-6 items-center justify-center rounded-full bg-background text-green-600 shadow",
              className,
            )}
          />
        }
      >
        <InfoIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex flex-col gap-3">
          {bookings.map((booking) => (
            <div key={booking.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">
                  {booking.from}–{booking.to}
                </p>
                {userId === booking.createdBy && (
                  <Button
                    render={
                      <Link
                        to="/activities/$activityId/book"
                        params={{ activityId }}
                        search={{ bookingId: booking.id, from }}
                      />
                    }
                    nativeButton={false}
                    variant="outline"
                    size="xs"
                  >
                    Edit
                  </Button>
                )}
              </div>
              {booking.description && <p className="text-xs">{booking.description}</p>}
              {booking.fixedLocation ? (
                <p className="text-xs">
                  <a
                    href={booking.fixedLocation.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground underline"
                  >
                    {booking.fixedLocation.name}
                  </a>
                </p>
              ) : (
                booking.location && (
                  <p className="text-xs">
                    {isUrl(booking.location) ? (
                      <a
                        href={booking.location}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground underline"
                      >
                        {booking.location}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{booking.location}</span>
                    )}
                  </p>
                )
              )}
              <p className="text-xs text-muted-foreground">Booked by {booking.createdByName}</p>
              <p className="text-xs text-muted-foreground">
                {idealMemberCount && `(${booking.attendeeNames.length}/${idealMemberCount}) `}
                {booking.attendeeNames.length > 0
                  ? `Joining: ${booking.attendeeNames.join(", ")}`
                  : "No one else joining yet."}
              </p>
              <a
                href={`/api/bookings/${booking.id}/ics`}
                className="text-xs text-muted-foreground underline"
              >
                Add to calendar
              </a>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
