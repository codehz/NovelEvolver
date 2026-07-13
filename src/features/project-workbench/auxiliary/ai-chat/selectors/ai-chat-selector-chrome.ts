import { cn } from "#app/shared/lib/ui/cn";

const selectorPanelSurfaceClass = cn(
  "overflow-hidden rounded-lg border border-titlebar-border bg-app-surface text-xs text-app-foreground shadow-quick-pick app-region-no-drag",
);

const selectorPanelMotionClass = cn(
  "translate-y-1 opacity-0 transition transition-discrete duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "open:translate-y-0 open:opacity-100",
  "open:starting:translate-y-1 open:starting:opacity-0",
);

export const agentSelectorAnchorClass = cn(
  "relative inline-flex max-w-full min-w-0 anchor-name-ai-chat-agent-selector",
);

export const modelSelectorAnchorClass = cn(
  "relative inline-flex max-w-full min-w-0 anchor-name-ai-chat-model-selector",
);

export const agentSelectorPopoverPanelClass = cn(
  "fixed inset-[unset] z-ai-chat-selector m-0 w-ai-chat-selector-picker max-w-[min(18rem,calc(100vw-1rem))] position-anchor-ai-chat-agent-selector",
  "bottom-[calc(anchor(top)+0.35rem)] left-[anchor(left)] position-try-fallbacks-flip-inline",
  selectorPanelMotionClass,
  selectorPanelSurfaceClass,
);

export const modelSelectorPopoverPanelClass = cn(
  "fixed inset-[unset] z-ai-chat-selector m-0 w-ai-chat-selector-picker max-w-[min(18rem,calc(100vw-1rem))] position-anchor-ai-chat-model-selector",
  "bottom-[calc(anchor(top)+0.35rem)] left-[anchor(left)] position-try-fallbacks-flip-inline",
  selectorPanelMotionClass,
  selectorPanelSurfaceClass,
);

export const selectorPanelHeightShellClass = cn("w-full overflow-hidden");

export const selectorPanelContentClass = cn("flex max-h-72 w-full flex-col");

export const selectorSearchWrapClass = cn("shrink-0 px-2 pt-2 pb-1.5");

export const selectorSearchInputClass = cn(
  "w-full rounded-sm border border-badge-background bg-app-background px-2 py-1 text-xs leading-tight text-app-foreground outline-none app-region-no-drag placeholder:text-app-muted",
);

export const selectorListClass = cn(
  "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 pt-0 pb-1.5",
);

export const selectorRowButtonClass = cn(
  "relative flex w-full cursor-default flex-col gap-0.5 rounded-sm px-2 py-1.5 text-left outline-none",
  "hover:bg-ctp-surface0/55",
  "focus-visible:bg-ctp-surface0/55 focus-visible:ring-1 focus-visible:ring-ctp-mauve/50",
);

export const selectorRowHighlightedClass = cn("bg-ctp-surface0/55");

export const selectorRowLabelClass = cn("min-w-0 truncate font-medium text-app-foreground");

export const selectorRowDetailClass = cn("min-w-0 truncate text-2xs text-app-muted");

export const selectorRowEmphasisClass = cn("text-ctp-mauve");

export const selectorEmptyClass = cn("rounded-sm p-2 text-app-muted");
