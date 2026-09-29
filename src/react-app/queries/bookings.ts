import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../api.ts";
import { activitiesQueryKey } from "./activities.ts";

export const useCreateBookingMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      activityId: string;
      date: string;
      from: string;
      to: string;
      attendeeUserIds: string[];
    }) => {
      const res = await client.activities[":id"].bookings.$post({
        param: { id: params.activityId },
        json: {
          date: params.date,
          from: params.from,
          to: params.to,
          attendeeUserIds: params.attendeeUserIds,
        },
      });
      if (!res.ok) throw new Error("Failed to create booking.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
    },
  });
};
