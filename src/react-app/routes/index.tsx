import { createFileRoute } from "@tanstack/react-router";

import { Home } from "../components/Home.tsx";

export const Route = createFileRoute("/")({
  component: Home,
});
