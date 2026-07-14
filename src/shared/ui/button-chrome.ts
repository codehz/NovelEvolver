import { cn } from "#app/shared/lib/ui/cn";
import {
  controlFocusVisibleClass,
  controlFocusVisibleInsetClass,
  iconButtonHoverClass,
  panelHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";

/** Shared layout baseline for text-bearing action buttons. */
export const buttonBaseClass = cn(
  "inline-flex shrink-0 items-center justify-center gap-1 outline-none select-none",
  "disabled:pointer-events-none disabled:opacity-50",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
);

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link" | "text";
export type ButtonSize = "sm" | "md" | "icon-sm" | "icon-md" | "icon-lg";

export const buttonVariantClass: Record<ButtonVariant, string> = {
  primary: cn(
    "rounded-sm bg-badge-background font-medium whitespace-nowrap text-badge-foreground",
    "hover:opacity-90",
    controlFocusVisibleClass,
  ),
  secondary: cn(
    "rounded-sm border border-titlebar-border bg-app-surface text-app-foreground",
    panelHoverClass,
    controlFocusVisibleClass,
  ),
  ghost: cn(
    "rounded-sm border-0 bg-transparent text-app-muted",
    iconButtonHoverClass,
    controlFocusVisibleClass,
  ),
  danger: cn(
    "rounded-sm border-0 bg-transparent text-ctp-red",
    "hover:bg-ctp-red/10 hover:text-ctp-red",
    controlFocusVisibleClass,
  ),
  link: cn(
    "rounded-sm border-0 bg-transparent p-0 text-ctp-mauve underline-offset-2",
    "hover:underline",
    controlFocusVisibleClass,
  ),
  text: cn(
    "rounded-sm border-0 bg-transparent text-badge-background",
    "hover:not-disabled:bg-badge-background/10 hover:not-data-disabled:bg-badge-background/10",
    controlFocusVisibleInsetClass,
    "disabled:cursor-default disabled:opacity-40 data-disabled:cursor-default data-disabled:opacity-40",
  ),
};

export const buttonSizeClass: Record<ButtonSize, string> = {
  sm: cn("px-2.5 py-1.5 text-2xs"),
  md: cn("rounded-md px-3 py-1.5 text-sm font-medium"),
  "icon-sm": cn("size-6 p-0"),
  "icon-md": cn("size-7 p-0"),
  "icon-lg": cn("size-8 p-0"),
};

/**
 * Resolve className for a design-system Button.
 * Domain chrome may still override via the caller's `className`.
 */
export function buttonClassName(
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string,
): string {
  return cn(buttonBaseClass, buttonVariantClass[variant], buttonSizeClass[size], className);
}
