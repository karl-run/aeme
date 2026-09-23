import { hc } from "hono/client";

import type { AppType } from "../worker/rpc/types.ts";

export const client = hc<AppType>("/api");
