import { cn } from "#app/lib/cn";

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
    <button
      aria-label={label}
      className={sidebarHeaderActionClass}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      <span aria-hidden="true" className={cn(sidebarHeaderIconClass, icon)} />
    </button>
  );
}
