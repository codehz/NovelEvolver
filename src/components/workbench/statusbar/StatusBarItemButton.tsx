import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

import {
  statusBarIconOnlyButtonClass,
  statusBarItemButtonClass,
  statusBarItemButtonWithIconClass,
} from "./statusbar-chrome";

export type StatusBarItemButtonProps = ComponentPropsWithoutRef<"button"> & {
  /** Iconify / codicon utility class, e.g. `icon-[codicon--sync]`. */
  icon?: string;
  children?: ReactNode;
};

export function StatusBarItemButton({
  icon,
  children,
  className,
  type = "button",
  ...rest
}: StatusBarItemButtonProps) {
  const iconOnly = icon != null && children == null;
  const withIcon = icon != null && children != null;

  return (
    <button
      className={cn(
        iconOnly
          ? statusBarIconOnlyButtonClass
          : withIcon
            ? statusBarItemButtonWithIconClass
            : statusBarItemButtonClass,
        className,
      )}
      type={type}
      {...rest}
    >
      {icon != null ? <span aria-hidden="true" className={icon} /> : null}
      {children}
    </button>
  );
}
