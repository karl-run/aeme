import { useQuery, useMutation, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { hc, InferResponseType, InferRequestType } from "hono/client";
import { useState } from "react";

import type { AppType } from "../worker/rpc/types";

const queryClient = new QueryClient();
const client = hc<AppType>("/api");

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Channels />
    </QueryClientProvider>
  );
}

const Channels = () => {
  const [name, setName] = useState("");
  const [suid, setSuid] = useState("");

  const query = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const res = await client.channel.$get();
      return await res.json();
    },
  });

  const $post = client.channel.$post;

  const createMutation = useMutation<
    InferResponseType<typeof $post>,
    Error,
    InferRequestType<typeof $post>["form"]
  >({
    mutationFn: async (channel) => {
      const res = await $post({ form: channel });
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["channels"] });
      setName("");
      setSuid("");
    },
    onError: (error) => {
      console.log(error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await client.channel[":id"].$delete({
        param: { id: id.toString() },
      });
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: (error) => {
      console.log(error);
    },
  });

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate({ name, suid });
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <input value={suid} onChange={(e) => setSuid(e.target.value)} placeholder="SUID" />
        <button type="submit">Add Channel</button>
      </form>

      <ul>
        {query.data?.channels.map((channel) => (
          <li key={channel.id}>
            {channel.name} ({channel.slackId})
            <button onClick={() => deleteMutation.mutate(channel.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
