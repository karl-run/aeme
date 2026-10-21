import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../api.ts";
import { activitiesQueryKey } from "./activities.ts";

/** The editable shape of a place: everything but which activity it belongs
 * to, which never changes. The optional two are null when left blank. */
export type LocationFields = {
  name: string;
  mapsUrl: string;
  bookingUrl: string | null;
  mapsPlaceName: string | null;
};

/** Fixed locations ride along in the activities payload, so there's no query
 * here to pair with these — just an invalidation of the activities list. */
export const useAddActivityLocationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { activityId: string } & LocationFields) => {
      const res = await client.activities[":id"].locations.$post({
        param: { id: params.activityId },
        json: {
          name: params.name,
          mapsUrl: params.mapsUrl,
          bookingUrl: params.bookingUrl,
          mapsPlaceName: params.mapsPlaceName,
        },
      });
      if (!res.ok) throw new Error("Failed to add location.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
    },
  });
};

/** Edits a place in place, so bookings already pointing at it pick up the
 * correction rather than keeping the old details. */
export const useUpdateActivityLocationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { activityId: string; locationId: string } & LocationFields) => {
      const res = await client.activities[":id"].locations[":locationId"].$put({
        param: { id: params.activityId, locationId: params.locationId },
        json: {
          name: params.name,
          mapsUrl: params.mapsUrl,
          bookingUrl: params.bookingUrl,
          mapsPlaceName: params.mapsPlaceName,
        },
      });
      if (!res.ok) throw new Error("Failed to save location.");
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
