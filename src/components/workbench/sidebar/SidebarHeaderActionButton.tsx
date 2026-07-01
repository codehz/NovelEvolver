import { cn } from "@/lib/cn";

import { sidebarHeaderActionClass, sidebarHeaderIconClass } from "./sidebar-header-chrome";

export interface SidebarHeaderActionButtonProps {
  /** Accessible label (also used as tooltip). */
  label: string;
  /** Tailwind icon class, e.g. `"icon-[codicon--new-file]"`. */
  icon: string;
  onClick: () => void;
}

export function SidebarHeaderActionButton({
  label,
  icon,
  onClick,
}: SidebarHeaderActionButtonProps) {
  return (
    <button
      aria-label={label}
      className={sidebarHeaderActionClass}
      title={label}
      type="button"
      onClick={onClick}
    >
      <span aria-hidden="true" className={cn(sidebarHeaderIconClass, icon)} />
    </button>
  );
}
