import { Link } from "@tanstack/react-router";

import { useLogoutMutation, useSessionQuery } from "../queries/session.ts";

export const Header = () => {
  const { data, isPending } = useSessionQuery();
  const logout = useLogoutMutation();

  const session = data?.session;

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
      <Link to="/" className="font-semibold">
        æme
      </Link>
      <div className="flex items-center gap-3 text-sm text-zinc-400">
        {isPending ? (
          <span className="h-4 w-40 animate-pulse rounded bg-zinc-700" />
        ) : (
          <>
            <span>
              {session
                ? `Logged in as ${session.userName} · #${session.channelName}`
                : "Not logged in"}
            </span>
            {session && (
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="underline disabled:opacity-50"
              >
                Log out
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
};
