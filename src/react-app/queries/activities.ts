import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "../api.ts";

export const activitiesQueryKey = ["activities"] as const;

export const useCreateActivityMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title: string;
      description: string;
      endTime: string | null;
      persistent: boolean;
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
