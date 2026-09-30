import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { client } from "../api.ts";
import { activitiesQueryKey } from "./activities.ts";
import { channelQueryKey } from "./channel.ts";
import { channelMembersQueryKey } from "./channelMembers.ts";

export const sessionQueryKey = ["session"] as const;
export const sessionChannelsQueryKey = ["session-channels"] as const;

const fetchSession = async () => {
  const res = await client.session.$get();
  if (!res.ok) throw new Error("Failed to load session.");
  return res.json();
};

export const useSessionQuery = () =>
  useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
  });

export const useSessionChannelsQuery = () =>
  useQuery({
    queryKey: sessionChannelsQueryKey,
    queryFn: async () => {
      const res = await client.session.channels.$get();
      if (!res.ok) throw new Error("Failed to load channels.");
      const { channels } = await res.json();
      return channels;
    },
  });

/** Points the current session at a different channel the user belongs to —
 * every channel-scoped query is invalidated afterward since they're all
 * implicitly scoped to `session.channelId` server-side. */
export const useSwitchChannelMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const res = await client.session.channel.$post({ json: { channelId } });
      if (!res.ok) throw new Error("Failed to switch channel.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
      queryClient.invalidateQueries({ queryKey: channelQueryKey });
      queryClient.invalidateQueries({ queryKey: channelMembersQueryKey });
    },
  });
};

export const useLoginMutation = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (otp: string) => {
      const res = await client.login.$post({ form: { otp } });
      if (!res.ok) throw new Error("Invalid or expired code.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      navigate({ to: "/" });
    },
  });
};

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.session.$delete();
      if (!res.ok) throw new Error("Failed to log out.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    },
  });
};
