import { cn } from "cn";
import { InfoIcon } from "lucide-react";

import { isUrl } from "../lib/is-url.ts";
import type { ActivityWithAvailability } from "../queries/activities.ts";
import { useSessionQuery } from "../queries/session.ts";
import { AddBookingDialog } from "./AddBookingDialog.tsx";
import { Button } from "./ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";

type BookingSummary = ActivityWithAvailability["bookings"][number];

type Props = {
  activityId: string;
  bookings: BookingSummary[];
  className?: string;
  /** Advisory headcount, shown alongside the attendee count as "N/ideal". */
  idealMemberCount?: number | null;
};

export const BookingInfoPopover = ({
  activityId,
  bookings,
  className,
  idealMemberCount,
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
                  <AddBookingDialog
                    activityId={activityId}
                    booking={{
                      id: booking.id,
                      date: booking.date,
                      from: booking.from,
                      to: booking.to,
                      description: booking.description,
                      location: booking.location,
                      attendeeUserIds: booking.attendeeUserIds,
                      guestNames: booking.guestNames,
                    }}
                    trigger={
                      <Button type="button" variant="outline" size="xs">
                        Edit
                      </Button>
                    }
                  />
                )}
              </div>
              {booking.description && <p className="text-xs">{booking.description}</p>}
              {booking.location && (
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
