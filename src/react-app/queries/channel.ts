import { useQuery } from "@tanstack/react-query";

import { client } from "../api.ts";

export const channelQueryKey = ["channel"] as const;

export const useChannelQuery = () =>
  useQuery({
    queryKey: channelQueryKey,
    queryFn: async () => {
      const res = await client.channel.$get();
      if (!res.ok) throw new Error("Failed to load channel.");
      const { channel } = await res.json();
      return channel;
    },
  });
