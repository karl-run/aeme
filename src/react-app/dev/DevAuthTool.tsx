import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "#/components/ui/button.tsx";
import { sessionQueryKey } from "#/queries/session.ts";

import { isFakeSessionEnabled, setFakeSessionEnabled } from "./fake-session.ts";

export const DevAuthTool = () => {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(isFakeSessionEnabled);

  const toggle = () => {
    const next = !enabled;
    setFakeSessionEnabled(next);
    setEnabled(next);
    queryClient.invalidateQueries({ queryKey: sessionQueryKey });
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-lg border border-amber-500/50 bg-zinc-900 px-3 py-2 text-xs text-amber-400 shadow-lg">
      <span>DEV</span>
      <Button
        type="button"
        size="xs"
        variant={enabled ? "destructive" : "secondary"}
        onClick={toggle}
      >
        {enabled ? "Fake session: on" : "Fake login"}
      </Button>
    </div>
  );
};
