import { cn } from "cn";
import { InfoIcon } from "lucide-react";

import type { ActivityWithAvailability } from "../queries/activities.ts";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.tsx";

type BookingSummary = ActivityWithAvailability["bookings"][number];

type Props = {
  bookings: BookingSummary[];
  className?: string;
};

export const BookingInfoPopover = ({ bookings, className }: Props) => {
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
              <p className="font-medium">
                {booking.from}–{booking.to}
              </p>
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
