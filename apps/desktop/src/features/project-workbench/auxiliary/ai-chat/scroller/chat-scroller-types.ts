/**
 * Scroll placement intent only. Layout pad is CSS last-turn min-height (independent).
 * priority: branch-pin > free | follow
 */
export type ChatScrollerMode = "follow" | "free" | "branch-pin";

export type ChatScrollerOpenAt = "start" | "end" | "last-anchor";

export type ChatScrollerScrollAlign = "start" | "center" | "end" | "nearest";

export type ChatScrollerScrollable = {
  /** Content is hidden above the viewport. */
  start: boolean;
  /** Content is hidden below the viewport (can scroll toward live edge). */
  end: boolean;
};

/** How message-id sequences changed between reconciles. */
export type ChatScrollerPathChange = "empty" | "same" | "append" | "prepend" | "replace";

export type ChatScrollerScrollOptions = {
  align?: ChatScrollerScrollAlign;
  behavior?: ScrollBehavior;
  scrollMargin?: number;
};

/** Captured synchronously on ‹n/m› click while the old path DOM is still mounted. */
export type ChatScrollerBranchPinCapture = {
  requestId: number;
  fromMessageId: string;
  fromIndexInPath: number;
  /** Message top relative to the scroller viewport top (CSS px). */
  viewportTop: number;
  /** Snapshot of message ids at capture time. */
  prevMessageIds: readonly string[];
};

export type ChatScrollerItemRegistration = {
  messageId: string;
  element: HTMLElement;
  turnAnchor: boolean;
};

export const DEFAULT_SCROLL_EDGE_THRESHOLD_PX = 8;
export const DEFAULT_PREVIOUS_PEEK_PX = 64;
export const DEFAULT_SCROLL_MARGIN_PX = 0;
export const SCROLL_POSITION_EPSILON_PX = 1;
export const BRANCH_PIN_MAX_FRAMES = 8;
