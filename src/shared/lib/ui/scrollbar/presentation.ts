import { cn } from "#app/shared/lib/ui/cn";

import type { ScrollbarControllerSnapshot } from "./scrollbar-controller";

/** Hides native scrollbars (pair with overflow auto on the scrollport). */
export const scrollbarHiddenViewportClass = cn(
  "scrollbar-hidden size-full min-h-0 overflow-x-hidden overflow-y-auto",
);

/** Apply on an existing scrollport (e.g. CodeMirror `.cm-scroller`). */
export const scrollbarNativeHiddenClass = cn("scrollbar-hidden");

export const scrollbarOverlayRootClass = cn("pointer-events-none absolute inset-0 z-10");

/** Pins rail inside scrollport so wheel still hits scrollable content (ScrollArea). */
export const scrollbarStickyRailClass = cn("pointer-events-none sticky top-0 z-10 h-0 w-full");

export const scrollbarTrackClass = cn(
  "pointer-events-auto absolute top-0 right-0 z-10 w-scrollbar",
);

export const scrollbarThumbClass = cn(
  "absolute inset-x-0 top-0 rounded-none bg-ctp-overlay1/72 opacity-0",
  "transition-opacity delay-400 duration-300 ease-out",
);

export const scrollbarThumbPeekClass = cn("opacity-40 delay-0");

export const scrollbarThumbActiveClass = cn("bg-ctp-overlay2/88 opacity-100 delay-0");

export function scrollbarThumbClassName(snapshot: ScrollbarControllerSnapshot): string {
  return cn(
    scrollbarThumbClass,
    snapshot.thumbShown && !snapshot.thumbActive && scrollbarThumbPeekClass,
    snapshot.thumbActive && scrollbarThumbActiveClass,
  );
}
