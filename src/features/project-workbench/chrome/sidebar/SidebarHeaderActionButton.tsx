import { cn } from "#app/shared/lib/ui/cn";
import { IconTooltip } from "#app/shared/ui/IconTooltip";

import { sidebarHeaderActionClass, sidebarHeaderIconClass } from "./sidebar-chrome";

export interface SidebarHeaderActionButtonProps {
  /** Accessible label (also used as tooltip). */
  label: string;
  /** Tailwind icon class, e.g. `"icon-[codicon--new-file]"`. */
  icon: string;
  disabled?: boolean;
  onClick: () => void;
}

export function SidebarHeaderActionButton({
  label,
  icon,
  disabled = false,
  onClick,
}: SidebarHeaderActionButtonProps) {
  return (
    <IconTooltip label={label} side="bottom">
      <button
        aria-label={label}
        className={sidebarHeaderActionClass}
        disabled={disabled}
        type="button"
        onClick={onClick}
      >
        <span aria-hidden="true" className={cn(sidebarHeaderIconClass, icon)} />
      </button>
    </IconTooltip>
  );
}
