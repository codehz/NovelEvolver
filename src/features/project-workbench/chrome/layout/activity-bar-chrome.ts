import { cn } from "#app/shared/lib/ui/cn";
import { controlFocusVisibleClass } from "#app/shared/lib/ui/interaction-chrome";

export const activityButtonClass = cn(
  "flex size-activity-bar shrink-0 items-center justify-center border-0 bg-transparent p-2.5",
  "text-ctp-overlay0 transition-colors duration-150",
  "hover:bg-transparent hover:text-ctp-mauve",
  controlFocusVisibleClass,
);

export const activityIconClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center text-[1.375rem] leading-none",
);
