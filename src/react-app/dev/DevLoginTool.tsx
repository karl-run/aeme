import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "#/components/ui/button.tsx";
import { activitiesQueryKey } from "#/queries/activities.ts";
import { sessionQueryKey } from "#/queries/session.ts";

const DEV_USERS = [
  { key: "a", label: "User A" },
  { key: "b", label: "User B" },
  { key: "c", label: "User C" },
] as const;

export const DevLoginTool = () => {
  const queryClient = useQueryClient();

  const devLogin = useMutation({
    mutationFn: async (userKey: string) => {
      const res = await fetch(`/api/dev/login?user=${userKey}`, { method: "POST" });
      if (!res.ok) throw new Error("Dev login failed.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      queryClient.invalidateQueries({ queryKey: activitiesQueryKey });
    },
  });

  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-zinc-900 px-3 py-2 text-xs text-amber-400 shadow-lg">
      <span>DEV</span>
      {DEV_USERS.map(({ key, label }) => (
        <Button
          key={key}
          type="button"
          size="xs"
          variant="secondary"
          onClick={() => devLogin.mutate(key)}
          disabled={devLogin.isPending}
        >
          {label}
        </Button>
      ))}
      {devLogin.isError && <span className="text-red-400">Failed</span>}
    </div>
  );
};
