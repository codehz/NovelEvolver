import type { ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { DisclosureChevron } from "#app/shared/ui";

/**
 * Right-edge disclosure chevron. Hidden until the parent
 * `group/disclosure-row` is hovered or focused (or always when expanded/forced).
 */
type HoverRevealChevronProps = {
  expanded: boolean;
  /** Force visible (e.g. while open). */
  forceVisible?: boolean;
  className?: string;
};

export function HoverRevealChevron({
  expanded,
  forceVisible = false,
  className,
}: HoverRevealChevronProps): ReactNode {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-auto inline-flex shrink-0 items-center justify-center",
        "opacity-0 transition-opacity",
        "group-focus-within/disclosure-row:opacity-100 group-hover/disclosure-row:opacity-100",
        (forceVisible || expanded) && "opacity-100",
        className,
      )}
    >
      <DisclosureChevron expanded={expanded} />
    </span>
  );
}
