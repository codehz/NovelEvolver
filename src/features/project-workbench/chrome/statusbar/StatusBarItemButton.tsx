import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";

import {
  statusBarIconOnlyButtonClass,
  statusBarItemButtonClass,
  statusBarItemButtonWithIconClass,
} from "./statusbar-chrome";

export type StatusBarItemButtonProps = ComponentPropsWithRef<"button"> & {
  /** Iconify / codicon utility class, e.g. `icon-[codicon--sync]`. */
  icon?: string;
  children?: ReactNode;
};

export function StatusBarItemButton({
  icon,
  children,
  className,
  type = "button",
  ref,
  ...rest
}: StatusBarItemButtonProps) {
  const iconOnly = icon != null && children == null;
  const withIcon = icon != null && children != null;

  return (
    <Button
      ref={ref}
      className={cn(
        iconOnly
          ? statusBarIconOnlyButtonClass
          : withIcon
            ? statusBarItemButtonWithIconClass
            : statusBarItemButtonClass,
        className,
      )}
      size="statusbar"
      type={type}
      variant="ghost"
      {...rest}
    >
      {icon != null ? <span aria-hidden="true" className={icon} /> : null}
      {children}
    </Button>
  );
}
