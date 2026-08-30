import { effects, preset } from "@codehz/auto-transition";

import { cn } from "#app/shared/lib/ui/cn";

/** Matches workbench overlay ease (`overlayOpacityMotionClass` / find bar). */
const SETTINGS_PAGE_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

/**
 * Opacity-only page swap for settings category tabs and model list/subpage.
 * Host should use `settingsPageTransitionHostClass` + `exitLayout="absolute"`.
 */
export const settingsPageFadeTransition = preset({
  enter: effects.fade(0),
  exit: effects.fade(0),
  timing: {
    enter: { duration: 220, easing: SETTINGS_PAGE_EASE },
    exit: { duration: 160, easing: SETTINGS_PAGE_EASE },
  },
});

/**
 * Relative flex host for absolute-exit page fades.
 * Needs definite height so exiting layers do not collapse the slot.
 */
export const settingsPageTransitionHostClass = cn(
  "relative flex min-h-0 flex-1 flex-col overflow-hidden",
);
