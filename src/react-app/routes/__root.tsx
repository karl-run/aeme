import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { lazy, Suspense } from "react";

import { Header } from "../components/Header";

// Dynamic import behind a statically-known `DEV` check: Vite inlines `false` for
// this in production, so Rollup dead-code-eliminates both the import and the
// dev/DevLoginTool.tsx chunk — it never ships in a deployed build.
const DevLoginTool = import.meta.env.DEV
  ? lazy(() => import("../dev/DevLoginTool.tsx").then((m) => ({ default: m.DevLoginTool })))
  : null;

const RootLayout = () => (
  <>
    <Header />
    <Outlet />
    {DevLoginTool && (
      <Suspense fallback={null}>
        <DevLoginTool />
      </Suspense>
    )}
    <TanStackRouterDevtools />
  </>
);

export const Route = createRootRoute({ component: RootLayout });
