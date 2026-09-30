import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ActivitySlot } from "../../worker/db/schema.ts";
import { client } from "../api.ts";
import { activitiesQueryKey } from "./activities.ts";

export const useUpsertAvailabilityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      activityId: string;
      slots: ActivitySlot[];
      declined: boolean;
    }) => {
      const res = await client.activities[":id"].availability.$put({
        param: { id: params.activityId },
        json: { slots: params.slots, declined: params.declined },
      });
      if (!res.ok) throw new Error("Failed to save availability.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
    },
  });
};
