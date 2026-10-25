import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { client } from "../api.ts";

export const calendarFeedQueryKey = ["calendar-feed"] as const;

/** The logged-in user's subscription URL, or null if they've never asked for
 * one. Not polled: it only changes when this page changes it. */
export const useCalendarFeedQuery = () =>
  useQuery({
    queryKey: calendarFeedQueryKey,
    queryFn: async () => {
      const res = await client.session["calendar-feed"].$get();
      if (!res.ok) throw new Error("Failed to load the calendar link.");
      const { url } = await res.json();
      return url;
    },
    staleTime: Infinity,
  });

/** Issues a subscription URL, which is both "create mine" and "that link got
 * out, give me another" — the server replaces whatever token was there. The
 * new URL is written straight into the cache so the field doesn't blank out
 * while the query refetches. */
export const useIssueCalendarFeedMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.session["calendar-feed"].$post();
      if (!res.ok) throw new Error("Failed to create the calendar link.");
      const { url } = await res.json();
      return url;
    },
    onSuccess: (url) => queryClient.setQueryData(calendarFeedQueryKey, url),
  });
};
