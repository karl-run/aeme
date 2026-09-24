import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "#/components/ui/button.tsx";
import { sessionQueryKey } from "#/queries/session.ts";

export const DevLoginTool = () => {
  const queryClient = useQueryClient();

  const devLogin = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/dev/login", { method: "POST" });
      if (!res.ok) throw new Error("Dev login failed.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    },
  });

  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-zinc-900 px-3 py-2 text-xs text-amber-400 shadow-lg">
      <span>DEV</span>
      <Button
        type="button"
        size="xs"
        variant="secondary"
        onClick={() => devLogin.mutate()}
        disabled={devLogin.isPending}
      >
        {devLogin.isPending ? "Logging in…" : "Fake login"}
      </Button>
      {devLogin.isError && <span className="text-red-400">Failed</span>}
    </div>
  );
};
