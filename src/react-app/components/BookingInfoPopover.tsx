import { cn } from "cn";
import { InfoIcon } from "lucide-react";

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
};

export const BookingInfoPopover = ({ activityId, bookings, className }: Props) => {
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
                      attendeeUserIds: booking.attendeeUserIds,
                    }}
                    trigger={
                      <Button type="button" variant="outline" size="xs">
                        Edit
                      </Button>
                    }
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Booked by {booking.createdByName}</p>
              <p className="text-xs text-muted-foreground">
                {booking.attendeeNames.length > 0
                  ? `Joining: ${booking.attendeeNames.join(", ")}`
                  : "No one else joining yet."}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
