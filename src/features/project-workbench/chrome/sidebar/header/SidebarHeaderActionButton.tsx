import type { MouseEvent } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { Button, AppTooltip } from "#app/shared/ui";

import { sidebarHeaderActionClass, sidebarHeaderIconClass } from "../sidebar-chrome";

export type SidebarHeaderActionButtonProps = {
  /** Accessible label (also used as tooltip). */
  label: string;
  /** Tailwind icon class, e.g. `"icon-[codicon--new-file]"`. */
  icon: string;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function SidebarHeaderActionButton({
  label,
  icon,
  disabled = false,
  onClick,
}: SidebarHeaderActionButtonProps) {
  return (
    <AppTooltip label={label} side="bottom">
      <Button
        aria-label={label}
        className={sidebarHeaderActionClass}
        disabled={disabled}
        size="icon-sm"
        variant="ghost"
        onClick={onClick}
      >
        <span aria-hidden="true" className={cn(sidebarHeaderIconClass, icon)} />
      </Button>
    </AppTooltip>
  );
}
