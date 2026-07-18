import {
  DEFAULT_SCROLL_EDGE_THRESHOLD_PX,
  SCROLL_POSITION_EPSILON_PX,
  type ChatScrollerPathChange,
  type ChatScrollerScrollAlign,
  type ChatScrollerScrollable,
} from "./chat-scroller-types";

type MessageLike = {
  id: string;
};

/**
 * Classify how the registered message-id sequence changed.
 * Used by reconcile to decide follow / free / branch-pin handling.
 */
export function classifyPathChange(
  prevIds: readonly string[],
  nextIds: readonly string[],
): ChatScrollerPathChange {
  if (nextIds.length === 0 && prevIds.length === 0) {
    return "empty";
  }
  if (nextIds.length === 0 || prevIds.length === 0) {
    // Empty → content or content → empty: treat as replace so open/reset paths handle it.
    return prevIds.length === 0 ? "append" : "replace";
  }

  if (prevIds.length === nextIds.length && prevIds.every((id, i) => id === nextIds[i])) {
    return "same";
  }

  // Pure append: next starts with prev.
  if (nextIds.length > prevIds.length && prevIds.every((id, i) => id === nextIds[i])) {
    return "append";
  }

  // Pure prepend: next ends with prev.
  if (
    nextIds.length > prevIds.length &&
    prevIds.every((id, i) => id === nextIds[nextIds.length - prevIds.length + i])
  ) {
    return "prepend";
  }

  return "replace";
}

/**
 * First index where message ids diverge (suffix fade / pin depth).
 * Returns min length when one is a pure prefix of the other (or equal).
 */
export function findDivergentIndex(
  prevMessages: readonly MessageLike[],
  nextMessages: readonly MessageLike[],
): number {
  const limit = Math.min(prevMessages.length, nextMessages.length);
  for (let index = 0; index < limit; index += 1) {
    if (prevMessages[index]!.id !== nextMessages[index]!.id) {
      return index;
    }
  }
  return limit;
}

export function findLastSharedPrefixId(
  prevIds: readonly string[],
  nextIds: readonly string[],
): string | null {
  const limit = Math.min(prevIds.length, nextIds.length);
  let last: string | null = null;
  for (let index = 0; index < limit; index += 1) {
    if (prevIds[index] !== nextIds[index]) {
      break;
    }
    last = nextIds[index]!;
  }
  return last;
}

/**
 * Resolve which message should stay pinned after a branch path replace.
 *
 * 1. Prefer `nextIds[fromIndexInPath]` (same-depth sibling).
 * 2. Else last shared id on the longest common prefix.
 * 3. Else first next id (root user sibling).
 * 4. Empty next → null.
 */
export function resolveBranchSwitchPinTarget(
  prevIds: readonly string[],
  nextIds: readonly string[],
  fromIndexInPath: number,
): string | null {
  if (nextIds.length === 0) {
    return null;
  }
  const atIndex = nextIds[fromIndexInPath];
  if (atIndex != null) {
    return atIndex;
  }
  const lastShared = findLastSharedPrefixId(prevIds, nextIds);
  if (lastShared != null) {
    return lastShared;
  }
  return nextIds[0] ?? null;
}

export function getElementViewportTop(element: HTMLElement, viewport: HTMLElement): number {
  return element.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
}

export function getMaxScrollTop(viewport: HTMLElement): number {
  return Math.max(0, viewport.scrollHeight - viewport.clientHeight);
}

/**
 * Scroll affordance for chrome (Jump to Latest), not for follow re-arm.
 *
 * - `start`: scrolled away from the top.
 * - `end`: real message content sticks out below the viewport.
 *
 * When `contentEndElement` is provided (last path message), empty CSS last-turn
 * min-height pad below that element does **not** count as content-below — otherwise
 * Jump to Latest lights up just to scroll into blank pad.
 * Without it, falls back to classic maxScroll residual.
 */
export function getScrollableEdges(
  viewport: HTMLElement,
  edgeThreshold = DEFAULT_SCROLL_EDGE_THRESHOLD_PX,
  contentEndElement?: HTMLElement | null,
): ChatScrollerScrollable {
  const max = getMaxScrollTop(viewport);
  const start = viewport.scrollTop > edgeThreshold;

  if (contentEndElement != null) {
    const lastBottom = contentEndElement.getBoundingClientRect().bottom;
    const viewBottom = viewport.getBoundingClientRect().bottom;
    return {
      start,
      end: lastBottom - viewBottom > edgeThreshold,
    };
  }

  return {
    start,
    end: max - viewport.scrollTop > edgeThreshold,
  };
}

/** True when scrollTop is within `edgeThreshold` of the live max (pad bottom). */
export function isAtScrollLiveEdge(
  viewport: HTMLElement,
  edgeThreshold = DEFAULT_SCROLL_EDGE_THRESHOLD_PX,
): boolean {
  return getMaxScrollTop(viewport) - viewport.scrollTop <= edgeThreshold;
}

/**
 * Layout top of `element` inside the scrollable content, in CSS px
 * (independent of current scrollTop when measured via getBoundingClientRect).
 */
export function getElementContentTop(element: HTMLElement, viewport: HTMLElement): number {
  const current = viewport.scrollTop;
  return current + getElementViewportTop(element, viewport);
}

/**
 * scrollTop that places `element` at the given viewport alignment.
 * `scrollMargin` is extra inset from the aligned edge; for start+peek use margin + peek.
 * Prefers live getBoundingClientRect so nested offsetParent chains do not matter.
 */
export function getScrollTopForElement({
  element,
  viewport,
  align = "start",
  scrollMargin = 0,
}: {
  element: HTMLElement;
  viewport: HTMLElement;
  align?: ChatScrollerScrollAlign;
  scrollMargin?: number;
}): number {
  const viewHeight = viewport.clientHeight;
  const max = getMaxScrollTop(viewport);
  const current = viewport.scrollTop;
  const elementTop = getElementContentTop(element, viewport);
  const elementHeight =
    typeof element.getBoundingClientRect === "function"
      ? element.getBoundingClientRect().height
      : element.offsetHeight;

  let next: number;
  switch (align) {
    case "end":
      next = elementTop + elementHeight - viewHeight + scrollMargin;
      break;
    case "center":
      next = elementTop + elementHeight / 2 - viewHeight / 2;
      break;
    case "nearest": {
      const visibleTop = current + scrollMargin;
      const visibleBottom = current + viewHeight - scrollMargin;
      if (elementTop >= visibleTop && elementTop + elementHeight <= visibleBottom) {
        return current;
      }
      if (elementTop < visibleTop) {
        next = elementTop - scrollMargin;
      } else {
        next = elementTop + elementHeight - viewHeight + scrollMargin;
      }
      break;
    }
    case "start":
    default:
      next = elementTop - scrollMargin;
      break;
  }

  return Math.min(max, Math.max(0, next));
}

/**
 * Pin `element` so its viewport-relative top equals `desiredViewportTop`.
 * Returns applied delta (0 when within epsilon / missing).
 */
export function applyElementViewportPin(
  element: HTMLElement,
  viewport: HTMLElement,
  desiredViewportTop: number,
  epsilon = SCROLL_POSITION_EPSILON_PX,
): number {
  const currentTop = getElementViewportTop(element, viewport);
  const delta = currentTop - desiredViewportTop;
  if (Math.abs(delta) <= epsilon) {
    return 0;
  }
  viewport.scrollTop += delta;
  return delta;
}

/** First newly appended id that is marked as a turn anchor. */
export function findFirstNewTurnAnchorId(
  prevIds: readonly string[],
  nextIds: readonly string[],
  turnAnchorIds: ReadonlySet<string>,
): string | null {
  for (let index = prevIds.length; index < nextIds.length; index += 1) {
    const id = nextIds[index]!;
    if (turnAnchorIds.has(id)) {
      return id;
    }
  }
  return null;
}

export function findLastTurnAnchorId(
  ids: readonly string[],
  turnAnchorIds: ReadonlySet<string>,
): string | null {
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    const id = ids[index]!;
    if (turnAnchorIds.has(id)) {
      return id;
    }
  }
  return null;
}
