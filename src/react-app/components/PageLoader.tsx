import { Spinner } from "./ui/spinner.tsx";

type Props = {
  /** Optional line under the spinner, for waits with a specific cause. */
  label?: string;
};

/** One spinner for the whole page, rather than placeholders shaped like the
 * content.
 *
 * It fades in over 500ms instead of appearing at once: a load that finishes
 * quickly leaves it barely visible, so there's no flash to apologise for and
 * no timer deciding when it's "slow enough" to show. */
export const PageLoader = ({ label }: Props) => (
  <div className="flex w-full animate-in flex-col items-center justify-center gap-3 py-24 text-muted-foreground fade-in duration-500">
    <Spinner className="size-6" />
    {label && <p className="text-sm">{label}</p>}
  </div>
);
