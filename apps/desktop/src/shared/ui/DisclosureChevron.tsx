import type { ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

/**
 * 展开箭头图标 + 展开时旋转 90° 动画。
 * 自包含 16×16 槽位布局颜色，不依赖外部 slot class。
 * Motion ease matches collapsibleHeightMotionClass (0.22,1,0.36,1).
 */
type DisclosureChevronProps = { expanded: boolean };

export function DisclosureChevron({ expanded }: DisclosureChevronProps): ReactNode {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center text-base leading-none",
        "text-ctp-mauve",
        "icon-[codicon--chevron-right]",
        "motion-safe:transition-transform motion-safe:duration-220 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
        expanded && "rotate-90",
      )}
    />
  );
}
