import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client } from "../api.ts";
import { channelQueryKey } from "./channel.ts";

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

/** Pre-loads a Slack member (from the live roster) into the local DB before
 * they've ever logged into æme, so they're immediately selectable e.g. as a
 * booking attendee. The server independently re-verifies the userId against
 * Slack's live roster and resolves the name itself — it doesn't trust a
 * client-supplied name. */
export const useAddChannelMemberMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { userId: string }) => {
      const res = await client.channel.members.$post({ json: params });
      if (!res.ok) throw new Error("Failed to add channel member.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelMembersQueryKey });
      queryClient.invalidateQueries({ queryKey: channelQueryKey });
    },
  });
};
