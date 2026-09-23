import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { client } from "../api.ts";

export const sessionQueryKey = ["session"] as const;

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
