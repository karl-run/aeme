import { Link } from "@tanstack/react-router";

import { useSessionQuery } from "../queries/session.ts";
import { AddActivityDialog } from "./AddActivityDialog.tsx";

export const Home = () => {
  const { data, isPending } = useSessionQuery();

  if (isPending) return null;

  const session = data?.session;

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 mt-20 text-center">
        <h1 className="text-2xl font-semibold">You're not logged in</h1>
        <p className="max-w-sm text-zinc-400">
          Open Slack and run the <code className="font-mono text-zinc-200">/æme</code> command in
          any channel to get a login link.
        </p>
        <p className="text-sm text-zinc-400">
          Have an OTP code?{" "}
          <Link to="/login" className="underline">
            Log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 flex flex-col gap-4 items-start">
      <h3>Welcome back, {session.userName}.</h3>
      <AddActivityDialog />
    </div>
  );
};
