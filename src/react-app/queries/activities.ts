import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client } from "../api.ts";

export const activitiesQueryKey = ["activities"] as const;

export const useActivitiesQuery = () =>
  useQuery({
    queryKey: activitiesQueryKey,
    queryFn: async () => {
      const res = await client.activities.$get();
      if (!res.ok) throw new Error("Failed to load activities.");
      const { activities } = await res.json();
      return activities;
    },
  });

export type ActivityWithAvailability = NonNullable<
  ReturnType<typeof useActivitiesQuery>["data"]
>[number];

export const useCreateActivityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title: string;
      description: string;
      endTime: string | null;
      persistent: boolean;
      slotGranularity: "day" | "hourly";
      suggestedDates: string[] | null;
    }) => {
      const res = await client.activities.$post({ json: params });
      if (!res.ok) throw new Error("Failed to create activity.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
    },
  });
};
