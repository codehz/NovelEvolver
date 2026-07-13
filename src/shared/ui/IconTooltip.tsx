import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactElement } from "react";

import { cn } from "#app/shared/lib/ui/cn";

const tooltipPositionerClass = cn("z-tooltip outline-none");

const tooltipPopupClass = cn(
  "max-w-xs origin-(--transform-origin) rounded-sm border border-titlebar-border bg-app-surface px-2 py-1 text-2xs text-app-foreground shadow-context-menu outline-none app-region-no-drag",
  "transition-[opacity,transform] duration-100 ease-out",
  "data-starting-style:scale-[0.98] data-starting-style:opacity-0",
  "data-ending-style:scale-[0.98] data-ending-style:opacity-0",
  "data-instant:transition-none",
);

export type IconTooltipSide = "top" | "bottom" | "left" | "right";

type IconTooltipProps = {
  /** Visible tooltip text; also used when the trigger lacks an accessible name. */
  label: string;
  /** Existing focusable control (usually a `<button>`). Merged via `render`. */
  children: ReactElement;
  side?: IconTooltipSide;
  /** Open delay in ms (Provider delay still applies for grouping). */
  delay?: number;
  /** Suppress open without disabling the trigger control. */
  disabled?: boolean;
};

/**
 * Base UI tooltip for icon-only controls. Pass the existing button/link as
 * `children`; props are merged onto it so nesting is avoided.
 */
export function IconTooltip({
  label,
  children,
  side = "bottom",
  delay = 400,
  disabled = false,
}: IconTooltipProps) {
  if (label === "") {
    return children;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger delay={delay} disabled={disabled} render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner
          className={tooltipPositionerClass}
          positionMethod="fixed"
          side={side}
          sideOffset={6}
        >
          <Tooltip.Popup className={tooltipPopupClass}>{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
