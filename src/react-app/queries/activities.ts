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
    // Keeps respondent/attendee counts fresh while the dashboard is open and
    // in focus, without relying on someone else's action to trigger a
    // refetch — `refetchIntervalInBackground` defaults to false, so this
    // pauses while the tab isn't focused.
    refetchInterval: 10_000,
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
      idealMemberCount: number | null;
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

export const useUpdateActivityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      activityId: string;
      title: string;
      description: string;
      idealMemberCount: number | null;
      suggestedDates: string[] | null;
    }) => {
      const res = await client.activities[":id"].$put({
        param: { id: params.activityId },
        json: {
          title: params.title,
          description: params.description,
          idealMemberCount: params.idealMemberCount,
          suggestedDates: params.suggestedDates,
        },
      });
      if (!res.ok) throw new Error("Failed to save changes.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
    },
  });
};
