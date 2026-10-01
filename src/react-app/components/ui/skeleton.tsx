import { cn } from "cn";
import type { ComponentProps } from "react";

/** Placeholder block shown while content loads. Size it to roughly match what
 * replaces it, so the layout doesn't jump when the real content arrives. */
export const Skeleton = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    data-slot="skeleton"
    aria-hidden
    className={cn("animate-pulse rounded-md bg-muted", className)}
    {...props}
  />
);
