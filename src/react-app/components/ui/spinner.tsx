import { cn } from "cn";
import type { ComponentProps } from "react";

/** A ring with one quadrant knocked out, spun. Inherits `currentColor`, so
 * the colour comes from whatever text colour it sits in. */
export const Spinner = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    data-slot="spinner"
    role="status"
    aria-label="Loading"
    className={cn(
      "inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent",
      className,
    )}
    {...props}
  />
);
