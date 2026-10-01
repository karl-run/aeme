import { cn } from "cn";
import type { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  description?: ReactNode;
  /** Right-aligned control in the header row, e.g. a primary action. */
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** A panel of related content, lifted off the page background onto a card.
 *
 * The dashboard already reads as a stack of cards; the sub-pages use the same
 * unit so a long page is a set of grouped panels rather than one flat column
 * of headings and text. */
export const Section = ({ title, description, action, children, className }: Props) => (
  <section
    className={cn(
      "flex w-full flex-col gap-4 rounded-lg border border-border bg-card p-4 md:p-5",
      className,
    )}
  >
    {(title || description || action) && (
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          {title && <h2 className="leading-tight font-semibold">{title}</h2>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )}
    {children}
  </section>
);
