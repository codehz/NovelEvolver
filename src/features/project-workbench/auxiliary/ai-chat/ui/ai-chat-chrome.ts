import { cn } from "#app/shared/lib/ui/cn";
import {
  collapsibleHeightMotionClass,
  controlDisabledSoftClass,
  controlFocusVisibleClass,
  panelHoverClass,
} from "#app/shared/lib/ui/interaction-chrome";
import { scrollEdgeMaskClass } from "#app/shared/lib/ui/scroll-edge-mask";

export const panelSectionClass = cn("mx-auto flex w-full max-w-3xl flex-col");
export const conversationRailClass = cn("gap-3 px-3 py-2.5 select-text");
/** ChatScroller frame: definite-height flex child that fills remaining rail height. */
export const conversationScrollerRootClass = cn(
  "relative flex h-0 min-h-0 flex-1 flex-col overflow-hidden",
);
/** Edge fades via `data-edge` from ChatScroller scrollable flags (see controller). */
export const conversationScrollerViewportClass = cn(
  "min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
  scrollEdgeMaskClass({ axis: "y", fade: "1.75rem" }),
);
/**
 * Last user turn + reply zone. CSS pad only (100cqh of the scroller viewport size
 * container) — never JS-measured message heights. 4rem ≈ previousPeek (64px).
 * After open / new turn the controller scrolls to end: bottom of this zone sits on
 * the viewport bottom, so ~4rem of previous content peeks above — no placeTurn math.
 */
export const conversationLastTurnClass = cn("flex min-h-[calc(100cqh-4rem)] flex-col gap-3");
export const conversationScrollerJumpButtonClass = cn(
  "absolute bottom-2 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1",
  "rounded-full border border-titlebar-border bg-app-surface/95 px-2.5 py-1",
  "text-2xs font-medium text-app-foreground shadow-sm backdrop-blur-sm",
  "transition-opacity",
  panelHoverClass,
  controlFocusVisibleClass,
  "inert:pointer-events-none inert:opacity-0",
);
/**
 * Branch-switch suffix enter: opacity only (no height/margin — ChatScroller contract).
 * Starts at opacity-0; host sets `data-entered` next frame to fade in.
 */
export const branchSuffixEnterClass = cn(
  "opacity-0 transition-opacity duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "data-entered:opacity-100",
  "motion-reduce:opacity-100 motion-reduce:transition-none",
);
export const assistantMessageBlockClass = cn("group/assistant-msg flex w-full flex-col gap-2");
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
  // Font size for headings / inline code lives on MarkdownStream; keep chrome only.
  "[&_code]:rounded-sm [&_code]:bg-app-crust [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono",
  "**:data-[streamdown='blockquote']:border-ctp-blue/40 **:data-[streamdown='blockquote']:text-app-muted",
  "**:data-[streamdown='code-block']:border-titlebar-border **:data-[streamdown='code-block']:bg-app-surface",
  "**:data-[streamdown='code-block-actions']:border-titlebar-border **:data-[streamdown='code-block-actions']:bg-app-surface/80",
  "**:data-[streamdown='code-block-body']:border-titlebar-border **:data-[streamdown='code-block-body']:bg-app-crust",
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
  // Heading / inline-code sizes come from MarkdownStream.
  "[&_code]:rounded-sm [&_code]:bg-app-background [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono",
  "**:data-[streamdown='blockquote']:border-ctp-blue/30 **:data-[streamdown='blockquote']:text-ctp-subtext0",
  "**:data-[streamdown='code-block']:border-titlebar-border **:data-[streamdown='code-block']:bg-app-surface/80",
  "**:data-[streamdown='code-block-actions']:border-titlebar-border **:data-[streamdown='code-block-actions']:bg-app-surface/70",
  "**:data-[streamdown='code-block-body']:border-titlebar-border **:data-[streamdown='code-block-body']:bg-app-background",
);
export const userMessageRowClass = cn("flex flex-col items-end gap-1");
export const userMessageBubbleClass = cn(
  "max-w-[88%] rounded-lg bg-ctp-surface0/55 px-3 py-2 text-chat leading-5 text-app-foreground",
);
export const messageBranchSwitcherClass = cn("inline-flex items-center gap-0.5 text-ctp-mauve");
export const messageBranchLabelClass = cn(
  "min-w-7 text-center text-2xs text-ctp-mauve tabular-nums",
);
/** Ghost icon actions on message rows (branch arrows, retry) — mauve accent. */
export const messageActionButtonClass = cn("text-ctp-mauve");
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
  "focus-visible:bg-app-crust",
  controlDisabledSoftClass,
);
export const agentSelectorButtonClass = cn(
  "inline-flex h-6 min-w-0 items-center gap-1 rounded-sm px-1 text-2xs text-ctp-mauve transition-colors",
  panelHoverClass,
  controlFocusVisibleClass,
  "focus-visible:bg-app-crust",
  controlDisabledSoftClass,
);
export const modelSelectorLabelClass = cn("min-w-0 truncate");
// Same as reasoningPanelClass: no root gap — keep spacing inside the panel body.
export const toolCallPanelClass = cn("flex flex-col");
/** Compact activity row: chevron | icon | label | summary | indicator. */
export const toolCallRowClass = cn(
  "grid w-full min-w-0 grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] items-center gap-1.5",
  "text-left text-2xs text-ctp-subtext1 outline-none",
);
export const toolCallToggleClass = cn(toolCallRowClass, controlFocusVisibleClass);
export const toolCallToggleActiveClass = cn("rounded-sm ring-1 ring-ctp-blue/40");
export const toolCallIconClass = cn("size-3.5 shrink-0 text-ctp-subtext0");
export const toolCallIconWriteClass = cn("size-3.5 shrink-0 text-ctp-blue/80");
export const toolCallIconErrorClass = cn("size-3.5 shrink-0 text-ctp-red");
export const toolCallIconRunningClass = cn("size-3.5 shrink-0 text-ctp-subtext0");
export const toolCallLabelClass = cn(
  "font-medium tracking-[0.02em] whitespace-nowrap text-ctp-subtext1",
);
export const toolCallLabelWriteClass = cn(
  "font-medium tracking-[0.02em] whitespace-nowrap text-ctp-blue",
);
export const toolCallSummaryClass = cn("min-w-0 truncate text-ctp-subtext0");
export const toolCallStatusClass = cn("text-2xs whitespace-nowrap text-ctp-overlay0 tabular-nums");
export const toolCallStatusErrorClass = cn("text-2xs whitespace-nowrap text-ctp-red tabular-nums");
export const toolCallBodyClass = cn(
  "flex flex-col gap-1.5 pt-1 text-chat-meta leading-5 text-app-muted",
);
export const toolCallErrorMessageClass = cn("text-chat-meta leading-5 text-ctp-red");
export const toolCallQuestionClass = cn("text-chat-meta leading-5 text-app-foreground");

/** Work / elevated card collapsible root — no flex gap (see reasoningPanelClass). */
export const workBlockPanelClass = cn("group/disclosure-row flex flex-col");
/** Summary row: label/meta left, hover chevron right. */
export const workBlockToggleClass = cn(
  "flex w-full min-w-0 items-center gap-1.5 text-left text-2xs text-ctp-subtext1 outline-none",
  controlFocusVisibleClass,
);
export const workBlockSummaryClass = cn("min-w-0 flex-1 truncate text-ctp-subtext0");
export const workBlockLabelClass = cn(
  "shrink-0 font-medium tracking-[0.02em] whitespace-nowrap text-ctp-subtext1",
);
export const workBlockBodyClass = cn("pt-1 text-chat-meta leading-5 text-app-muted");
/**
 * Live activity window: clamp height while tools are running.
 * Edge fades via `data-edge` from `bindScrollEdgeMask` (see ClippedLivePanel).
 */
export const liveClipPanelClass = cn(
  "max-h-44 overflow-x-hidden overflow-y-auto",
  scrollEdgeMaskClass({ axis: "y", fade: "1.75rem" }),
);

/** Elevated card shell (subagent / ask_user) — light surface, no heavy chrome. */
export const elevatedCardPanelClass = cn(
  "group/disclosure-row flex flex-col rounded-sm border border-titlebar-border/60 bg-app-surface/40",
);
export const elevatedCardHeaderClass = cn(
  "flex w-full min-w-0 items-center gap-1.5 px-2 py-1 text-left text-2xs text-ctp-subtext1 outline-none",
  controlFocusVisibleClass,
);
export const elevatedCardBodyClass = cn(
  "flex flex-col gap-1.5 px-2 pb-2 text-chat-meta leading-5 text-app-muted",
);

export const warningBannerClass = cn(
  "rounded-sm border border-ctp-yellow/40 bg-ctp-yellow/10 px-3 py-2 text-xs break-all whitespace-pre-wrap text-ctp-yellow select-text",
);
