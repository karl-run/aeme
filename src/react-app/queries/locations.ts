import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../api.ts";
import { activitiesQueryKey } from "./activities.ts";

/** Fixed locations ride along in the activities payload, so there's no query
 * here to pair with these — just an invalidation of the activities list. */
export const useAddActivityLocationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { activityId: string; name: string; mapsUrl: string }) => {
      const res = await client.activities[":id"].locations.$post({
        param: { id: params.activityId },
        json: { name: params.name, mapsUrl: params.mapsUrl },
      });
      if (!res.ok) throw new Error("Failed to add location.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
    },
  });
};

/** Retires a location: bookings that already used it keep showing it, it just
 * stops being offered for new ones. */
export const useRemoveActivityLocationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { activityId: string; locationId: string }) => {
      const res = await client.activities[":id"].locations[":locationId"].$delete({
        param: { id: params.activityId, locationId: params.locationId },
      });
      if (!res.ok) throw new Error("Failed to remove location.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
    },
  });
};
