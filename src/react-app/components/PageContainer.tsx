import { cn } from "cn";
import type { ComponentProps } from "react";

export const PageContainer = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("mx-auto w-full max-w-7xl", className)} {...props} />
);
