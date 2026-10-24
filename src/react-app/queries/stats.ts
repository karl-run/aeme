import { useQuery } from "@tanstack/react-query";

import { client } from "../api.ts";

export const bookingStatsQueryKey = (activityId: string) => ["stats", activityId] as const;

/** What an activity's finished bookings add up to — who came, where it
 * happened — fetched only once someone opens the stats, which is what
 * `enabled` holds back.
 *
 * Deliberately not on the activities poll: this is a group-by over the whole
 * history, and the dashboard refetches every ten seconds. Once loaded it's
 * left alone (no interval): the history only changes when a past booking is
 * edited, which the mutations already invalidate. */
export const useBookingStatsQuery = (activityId: string, enabled: boolean) =>
  useQuery({
    queryKey: bookingStatsQueryKey(activityId),
    queryFn: async () => {
      const res = await client.activities[":id"].stats.$get({
        param: { id: activityId },
      });
      if (!res.ok) throw new Error("Failed to load booking stats.");
      return res.json();
    },
    enabled,
  });
