import { useQuery } from "@tanstack/react-query";

import { client } from "../api.ts";

export const channelMembersQueryKey = ["channel-members"] as const;

export const useChannelMembersQuery = () =>
  useQuery({
    queryKey: channelMembersQueryKey,
    queryFn: async () => {
      const res = await client.channels.members.$get();
      if (!res.ok) throw new Error("Failed to load channel members.");
      const { members } = await res.json();
      return members;
    },
  });
