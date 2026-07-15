import { cn } from "#app/shared/lib/ui/cn";
import {
  collapsibleHeightMotionClass,
  controlDisabledSoftClass,
  controlFocusVisibleClass,
  panelHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";

export const panelSectionClass = cn("mx-auto flex w-full max-w-3xl flex-col");
export const conversationRailClass = cn("gap-4 px-3 py-2.5 select-text");
/** MessageScroller frame: definite-height flex child that fills remaining rail height. */
export const conversationScrollerRootClass = cn(
  "relative flex h-0 min-h-0 flex-1 flex-col overflow-hidden",
);
export const conversationScrollerViewportClass = cn(
  "min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
);
export const conversationScrollerJumpButtonClass = cn(
  "absolute bottom-2 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1",
  "rounded-full border border-titlebar-border bg-app-surface/95 px-2.5 py-1",
  "text-2xs font-medium text-app-foreground shadow-sm backdrop-blur-sm",
  "transition-opacity",
  panelHoverClass,
  controlFocusVisibleClass,
  "inert:pointer-events-none inert:opacity-0",
);
export const assistantMessageBlockClass = cn("group/assistant-msg flex w-full flex-col gap-1");
export const assistantMessageFooterClass = cn("flex w-full min-w-0 items-center gap-2 pt-0.5");
/** Hide completed footer until the block is hovered or focus moves into it. */
export const assistantMessageFooterHoverRevealClass = cn(
  "opacity-0 transition-opacity",
  "pointer-events-none",
  "group-hover/assistant-msg:pointer-events-auto group-hover/assistant-msg:opacity-100",
  "group-focus-within/assistant-msg:pointer-events-auto group-focus-within/assistant-msg:opacity-100",
);
export const assistantMessageFooterLeadingClass = cn("flex shrink-0 items-center");
/** Flex slot so AppTooltip root can sit on the trailing edge without losing `ml-auto`. */
export const assistantMessageFooterTrailingClass = cn("ml-auto min-w-0");
export const assistantMessageModelLabelClass = cn(
  "block max-w-full truncate text-right text-2xs text-ctp-subtext1 tabular-nums outline-none",
);
export const assistantMessageBodyClass = cn(
  "text-chat leading-5 text-app-foreground",
  "[&_a]:text-ctp-blue [&_a]:underline [&_a]:underline-offset-2",
  "[&_code]:rounded-sm [&_code]:bg-window-chrome [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-chat-meta",
  "**:data-[streamdown='blockquote']:border-ctp-blue/40 **:data-[streamdown='blockquote']:text-app-muted",
  "**:data-[streamdown='code-block']:border-titlebar-border **:data-[streamdown='code-block']:bg-app-surface",
  "**:data-[streamdown='code-block-actions']:border-titlebar-border **:data-[streamdown='code-block-actions']:bg-app-surface/80",
  "**:data-[streamdown='code-block-body']:border-titlebar-border **:data-[streamdown='code-block-body']:bg-window-chrome",
  "**:data-[streamdown='heading-1']:text-base",
  "**:data-[streamdown='heading-1']:text-ctp-mauve **:data-[streamdown='heading-2']:text-ctp-mauve **:data-[streamdown='heading-3']:text-ctp-mauve",
  "**:data-[streamdown='inline-code']:text-ctp-green",
);
// No gap on Collapsible.Root — flex gap stays after panel height hits 0 until
// unmount, causing a 1-step jump at the end of the collapse animation. Spacing
// lives on the body (inside the measured panel) instead.
export const reasoningPanelClass = cn("flex flex-col");
export const reasoningToggleClass = cn(
  "flex w-full items-center gap-1.5 text-left text-2xs text-ctp-subtext1 outline-none",
  controlFocusVisibleClass,
);
export const reasoningLabelClass = cn("font-medium tracking-[0.02em] text-ctp-mauve");
export const reasoningMetaClass = cn(
  "overflow-hidden text-2xs text-ellipsis whitespace-nowrap text-ctp-subtext1 tabular-nums",
);
/** Base UI Collapsible.Panel shell — height driven by `--collapsible-panel-height`. */
export const collapsiblePanelClass = cn(
  "h-(--collapsible-panel-height) overflow-hidden outline-none",
  collapsibleHeightMotionClass,
  "data-ending-style:h-0 data-starting-style:h-0",
  "[&[hidden]:not([hidden='until-found'])]:hidden",
);
export const reasoningBodyClass = cn(
  "pt-1 text-chat-meta leading-5 text-app-muted",
  "[&_code]:rounded-sm [&_code]:bg-app-background [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono",
  "**:data-[streamdown='blockquote']:border-ctp-blue/30 **:data-[streamdown='blockquote']:text-ctp-subtext0",
  "**:data-[streamdown='code-block']:border-titlebar-border **:data-[streamdown='code-block']:bg-app-surface/80",
  "**:data-[streamdown='code-block-actions']:border-titlebar-border **:data-[streamdown='code-block-actions']:bg-app-surface/70",
  "**:data-[streamdown='code-block-body']:border-titlebar-border **:data-[streamdown='code-block-body']:bg-app-background",
  "**:data-[streamdown='heading-1']:text-sm **:data-[streamdown='heading-2']:text-sm **:data-[streamdown='heading-3']:text-sm",
);
export const userMessageRowClass = cn("flex justify-end");
export const userMessageBubbleClass = cn(
  "max-w-[88%] rounded-lg bg-window-chrome px-3 py-2 text-chat leading-5 text-app-foreground shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--color-ctp-surface0)_24%,transparent)]",
);
/** Slash chip inside a sent user bubble (matches composer prompt-chip semantics). */
export const userSlashChipClass = cn(
  "mr-1 inline-flex max-w-full shrink-0 items-center rounded-sm border border-ctp-mauve/35",
  "bg-ctp-mauve/14 px-[0.35em] text-[0.92em] leading-[1.4] font-semibold text-ctp-mauve",
  "align-baseline whitespace-nowrap select-none",
);
/** Mention chip inside a sent user bubble (matches composer mention-chip semantics). */
export const userMentionChipClass = cn(
  "mx-[0.1em] inline-flex max-w-full shrink-0 items-center rounded-sm border border-ctp-teal/35",
  "bg-ctp-teal/14 px-[0.35em] text-[0.92em] leading-[1.4] font-semibold text-ctp-teal",
  "align-baseline whitespace-nowrap select-none",
);
export const composerShellClass = cn(
  "mx-auto flex w-full max-w-3xl flex-col gap-1 rounded-lg border border-transparent bg-app-background p-1.5 transition-colors",
  "focus-within:border-badge-background",
);
export const composerTextareaClass = cn(
  "field-sizing-content min-h-20 w-full resize-none border-0 bg-transparent px-1 py-0.5 text-chat leading-5 text-app-foreground outline-none placeholder:text-ctp-overlay0",
  "max-h-[50vh]",
);
export const sendButtonClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded-sm bg-transparent text-ctp-mauve transition-colors",
  panelHoverClass,
  controlFocusVisibleClass,
  // Icon-color mute (not opacity) so the send glyph stays aligned with stop/cancel chrome.
  "disabled:pointer-events-none disabled:text-ctp-overlay0",
);
export const stopButtonClass = cn(
  "inline-flex size-6 shrink-0 items-center justify-center rounded-sm bg-transparent text-ctp-red transition-colors",
  panelHoverClass,
  controlFocusVisibleClass,
);
export const modelSelectorButtonClass = cn(
  "inline-flex h-6 min-w-0 items-center gap-1 rounded-sm px-1 text-2xs text-ctp-mauve transition-colors",
  panelHoverClass,
  controlFocusVisibleClass,
  "focus-visible:bg-window-chrome",
  controlDisabledSoftClass,
);
export const agentSelectorButtonClass = cn(
  "inline-flex h-6 min-w-0 items-center gap-1 rounded-sm px-1 text-2xs text-ctp-mauve transition-colors",
  panelHoverClass,
  controlFocusVisibleClass,
  "focus-visible:bg-window-chrome",
  controlDisabledSoftClass,
);
export const modelSelectorLabelClass = cn("min-w-0 truncate");
// Same as reasoningPanelClass: no root gap — keep spacing inside the panel body.
export const toolCallPanelClass = cn("flex flex-col");
export const toolCallToggleClass = cn(
  "grid w-full grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-1.5 text-left text-2xs text-ctp-subtext1 outline-none",
  controlFocusVisibleClass,
);
export const toolCallToggleActiveClass = cn("rounded-sm ring-1 ring-ctp-blue/40");
export const toolCallLabelClass = cn(
  "font-medium tracking-[0.02em] whitespace-nowrap text-ctp-blue",
);
export const toolCallStatusClass = cn("text-2xs whitespace-nowrap text-ctp-overlay0");
export const toolCallBodyClass = cn(
  "flex flex-col gap-2 pt-1 text-chat-meta leading-5 text-app-muted",
);
export const toolCallQuestionClass = cn("text-chat-meta leading-5 text-app-foreground");
export const warningBannerClass = cn(
  "rounded-sm border border-ctp-yellow/40 bg-ctp-yellow/10 px-3 py-2 text-xs break-all whitespace-pre-wrap text-ctp-yellow select-text",
);
