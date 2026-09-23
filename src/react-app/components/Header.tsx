import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { client } from "../api.ts";

export const Header = () => {
  const { data } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await client.session.$get();
      if (!res.ok) throw new Error("Failed to load session.");
      return res.json();
    },
  });

  const session = data?.session;

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
      <Link to="/" className="font-semibold">
        æme
      </Link>
      <span className="text-sm text-zinc-400">
        {session ? `Logged in as ${session.userId} · #${session.channelName}` : "Not logged in"}
      </span>
    </header>
  );
};
