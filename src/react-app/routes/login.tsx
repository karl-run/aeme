import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { hc } from "hono/client";
import { useState } from "react";

import type { AppType } from "../../worker/rpc/types.ts";

const client = hc<AppType>("/api");

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const [otp, setOtp] = useState("");

  const login = useMutation({
    mutationFn: async (otp: string) => {
      const res = await client.login.$post({ form: { otp } });
      if (!res.ok) throw new Error("Invalid or expired code.");
      return res.json();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login.mutate(otp);
  }

  return (
    <div className="p-2">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-xs">
        <label htmlFor="otp">Enter your code</label>
        <input
          id="otp"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          maxLength={6}
          className="border rounded px-2 py-1"
        />
        <button type="submit" disabled={login.isPending} className="border rounded px-2 py-1">
          Log in
        </button>
      </form>
      {login.isSuccess && <p>Logged in.</p>}
      {login.isError && <p>Invalid or expired code.</p>}
    </div>
  );
}
