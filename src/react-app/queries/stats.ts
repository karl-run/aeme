import { useQuery } from "@tanstack/react-query";

import { client } from "../api.ts";

export const attendanceStatsQueryKey = (activityId: string) =>
  ["stats", "attendance", activityId] as const;

/** Attendance across an activity's finished bookings, fetched only once
 * someone opens the stats — `enabled` is what holds it back.
 *
 * Deliberately not on the activities poll: this is a group-by over the whole
 * history, and the dashboard refetches every ten seconds. Once loaded it's
 * left alone (no interval): the history only changes when a past booking is
 * edited, which the mutations already invalidate. */
export const useAttendanceStatsQuery = (activityId: string, enabled: boolean) =>
  useQuery({
    queryKey: attendanceStatsQueryKey(activityId),
    queryFn: async () => {
      const res = await client.activities[":id"].stats.attendance.$get({
        param: { id: activityId },
      });
      if (!res.ok) throw new Error("Failed to load attendance stats.");
      return res.json();
    },
    enabled,
  });
