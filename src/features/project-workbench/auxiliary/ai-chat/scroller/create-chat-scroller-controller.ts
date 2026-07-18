import {
  applyElementViewportPin,
  classifyPathChange,
  findFirstNewTurnAnchorId,
  findLastSharedPrefixId,
  getElementViewportTop,
  getMaxScrollTop,
  getScrollableEdges,
  isAtScrollLiveEdge,
  resolveBranchSwitchPinTarget,
} from "./chat-scroller-geometry";
import {
  BRANCH_PIN_MAX_FRAMES,
  DEFAULT_SCROLL_EDGE_THRESHOLD_PX,
  SCROLL_POSITION_EPSILON_PX,
  type ChatScrollerBranchPinCapture,
  type ChatScrollerMode,
  type ChatScrollerOpenAt,
  type ChatScrollerScrollable,
} from "./chat-scroller-types";

export type ChatScrollerControllerOptions = {
  autoScroll?: boolean;
  openAt?: ChatScrollerOpenAt;
  scrollEdgeThreshold?: number;
};

export type ChatScrollerItemOptions = {
  turnAnchor?: boolean;
  /**
   * When false, excluded from path-change / branch-pin id lists
   * (meta banners, loading, empty state).
   */
  pathMember?: boolean;
};

/**
 * Scroll placement only. Layout pad is CSS last-turn min-height (100cqh - peek).
 *
 * - follow: stick to live edge on content growth
 * - free: leave scrollTop alone (stream grows in place; items use overflow-anchor:none)
 * - branch-pin: temporary FLIP pin after path.replaced
 *
 * New turn / last-anchor open: scroll to end (not placeTurn math). With CSS pad,
 * end placement leaves ~peek of previous content above the new user message.
 */
export type ChatScrollerController = {
  setViewport: (element: HTMLElement | null) => void;
  setContent: (element: HTMLElement | null) => void;
  registerItem: (
    messageId: string,
    element: HTMLElement,
    options?: boolean | ChatScrollerItemOptions,
  ) => void;
  unregisterItem: (messageId: string, element: HTMLElement) => void;
  captureBranchPin: (
    messageId: string,
    fromIndexInPath: number,
    prevMessageIds: readonly string[],
  ) => ChatScrollerBranchPinCapture | null;
  beginBranchPin: (capture: ChatScrollerBranchPinCapture) => void;
  reconcile: () => void;
  scrollToEnd: (behavior?: ScrollBehavior) => void;
  handleUserScrollIntent: () => void;
  handleViewportScroll: () => void;
  subscribeScrollable: (listener: () => void) => () => void;
  getScrollableSnapshot: () => ChatScrollerScrollable;
  dispose: () => void;
};

const EMPTY_SCROLLABLE: ChatScrollerScrollable = { start: false, end: false };

export function createChatScrollerController(
  options: ChatScrollerControllerOptions = {},
): ChatScrollerController {
  const autoScroll = options.autoScroll ?? true;
  const openAt: ChatScrollerOpenAt = options.openAt ?? "last-anchor";
  const edgeThreshold = options.scrollEdgeThreshold ?? DEFAULT_SCROLL_EDGE_THRESHOLD_PX;

  let viewport: HTMLElement | null = null;
  let content: HTMLElement | null = null;
  let mode: ChatScrollerMode = autoScroll ? "follow" : "free";
  let openApplied = false;
  let lastScrollTop = 0;
  let suppressUserIntent = false;

  const items = new Map<
    string,
    { element: HTMLElement; turnAnchor: boolean; pathMember: boolean }
  >();
  let lastIds: string[] = [];
  let orderedIds: string[] = [];
  let nextRequestId = 1;

  let pendingPin: ChatScrollerBranchPinCapture | null = null;
  let activePin: {
    requestId: number;
    targetId: string;
    viewportTop: number;
    frames: number;
  } | null = null;
  let pinRaf = 0;

  let contentRo: ResizeObserver | null = null;
  let viewportRo: ResizeObserver | null = null;
  let reconcileRaf = 0;

  let scrollable: ChatScrollerScrollable = EMPTY_SCROLLABLE;
  const scrollableListeners = new Set<() => void>();

  const emitScrollable = () => {
    for (const listener of scrollableListeners) {
      listener();
    }
  };

  const lastPathElement = (): HTMLElement | null => {
    const lastId = orderedIds[orderedIds.length - 1];
    if (lastId == null) {
      return null;
    }
    return items.get(lastId)?.element ?? null;
  };

  const commitScrollable = () => {
    if (viewport == null) {
      if (scrollable.start || scrollable.end) {
        scrollable = EMPTY_SCROLLABLE;
        emitScrollable();
      }
      return;
    }
    // Jump chrome uses last message bottom — ignore CSS last-turn empty pad.
    const next = getScrollableEdges(viewport, edgeThreshold, lastPathElement());
    const published: ChatScrollerScrollable =
      mode === "follow" ? { start: next.start, end: false } : next;
    if (published.start !== scrollable.start || published.end !== scrollable.end) {
      scrollable = published;
      emitScrollable();
    }
  };

  const recomputeOrderedIds = () => {
    if (content == null) {
      orderedIds = [...items.entries()].filter(([, entry]) => entry.pathMember).map(([id]) => id);
      return;
    }
    const nodes = content.querySelectorAll<HTMLElement>("[data-message-id]");
    const next: string[] = [];
    for (const node of nodes) {
      const id = node.dataset.messageId;
      if (id == null) {
        continue;
      }
      const entry = items.get(id);
      if (entry?.pathMember) {
        next.push(id);
      }
    }
    orderedIds =
      next.length > 0
        ? next
        : [...items.entries()].filter(([, entry]) => entry.pathMember).map(([id]) => id);
  };

  const resolveItemOptions = (
    options?: boolean | ChatScrollerItemOptions,
  ): { turnAnchor: boolean; pathMember: boolean } => {
    if (typeof options === "boolean") {
      return { turnAnchor: options, pathMember: true };
    }
    return {
      turnAnchor: options?.turnAnchor ?? false,
      pathMember: options?.pathMember ?? true,
    };
  };

  const turnAnchorIds = (): Set<string> =>
    new Set([...items.entries()].filter(([, v]) => v.turnAnchor).map(([id]) => id));

  const scrollToPosition = (top: number, behavior: ScrollBehavior = "auto") => {
    if (viewport == null) {
      return;
    }
    suppressUserIntent = true;
    viewport.scrollTo({ top, behavior });
    lastScrollTop = viewport.scrollTop;
    window.requestAnimationFrame(() => {
      suppressUserIntent = false;
      if (viewport != null) {
        lastScrollTop = viewport.scrollTop;
      }
      commitScrollable();
    });
  };

  const pinElement = (element: HTMLElement, desiredTop: number) => {
    if (viewport == null) {
      return 0;
    }
    return applyElementViewportPin(element, viewport, desiredTop, SCROLL_POSITION_EPSILON_PX);
  };

  /** Scroll to live end and enter follow (Jump / openAt=end). */
  const doScrollToEnd = (behavior: ScrollBehavior = "auto") => {
    if (viewport == null) {
      return;
    }
    activePin = null;
    pendingPin = null;
    mode = autoScroll ? "follow" : "free";
    scrollToPosition(getMaxScrollTop(viewport), behavior);
  };

  /**
   * Scroll to live end without arming follow — used for open last-anchor and new user turns.
   * CSS last-turn min-height supplies the pad; no element top measurement.
   */
  const scrollToEndFree = () => {
    if (viewport == null) {
      return;
    }
    activePin = null;
    pendingPin = null;
    mode = "free";
    scrollToPosition(getMaxScrollTop(viewport), "auto");
  };

  const applyOpenAt = () => {
    if (openApplied || viewport == null || orderedIds.length === 0) {
      return false;
    }
    openApplied = true;

    if (openAt === "start") {
      mode = "free";
      scrollToPosition(0, "auto");
      return true;
    }
    if (openAt === "end") {
      doScrollToEnd("auto");
      return true;
    }

    // last-anchor: end of CSS-padded last turn = natural turn framing; stay free for stream.
    scrollToEndFree();
    return true;
  };

  const finishBranchPin = () => {
    if (pinRaf !== 0) {
      window.cancelAnimationFrame(pinRaf);
      pinRaf = 0;
    }
    activePin = null;
    pendingPin = null;
    if (mode === "branch-pin") {
      mode = "free";
    }
    commitScrollable();
  };

  const runBranchPinFrame = () => {
    if (activePin == null || viewport == null) {
      finishBranchPin();
      return;
    }
    const entry = items.get(activePin.targetId);
    if (entry == null) {
      finishBranchPin();
      return;
    }
    const delta = pinElement(entry.element, activePin.viewportTop);
    activePin.frames += 1;
    if (
      Math.abs(delta) <= SCROLL_POSITION_EPSILON_PX ||
      activePin.frames >= BRANCH_PIN_MAX_FRAMES
    ) {
      finishBranchPin();
      return;
    }
    pinRaf = window.requestAnimationFrame(runBranchPinFrame);
  };

  const activateBranchPin = (capture: ChatScrollerBranchPinCapture) => {
    const targetId = resolveBranchSwitchPinTarget(
      capture.prevMessageIds,
      orderedIds,
      capture.fromIndexInPath,
    );
    if (targetId == null) {
      finishBranchPin();
      return;
    }
    pendingPin = null;
    mode = "branch-pin";
    activePin = {
      requestId: capture.requestId,
      targetId,
      viewportTop: capture.viewportTop,
      frames: 0,
    };
    const entry = items.get(targetId);
    if (entry != null && viewport != null) {
      pinElement(entry.element, capture.viewportTop);
    }
    if (pinRaf !== 0) {
      window.cancelAnimationFrame(pinRaf);
    }
    pinRaf = window.requestAnimationFrame(runBranchPinFrame);
  };

  const preserveSharedPrefix = (prevIds: readonly string[], nextIds: readonly string[]) => {
    if (viewport == null) {
      return;
    }
    const sharedId = findLastSharedPrefixId(prevIds, nextIds);
    if (sharedId == null) {
      return;
    }
    const entry = items.get(sharedId);
    if (entry == null) {
      return;
    }
    const top = getElementViewportTop(entry.element, viewport);
    pinElement(entry.element, top);
  };

  const reconcileNow = () => {
    if (viewport == null) {
      return;
    }
    recomputeOrderedIds();
    const prevIds = lastIds;
    const nextIds = orderedIds;
    const change = classifyPathChange(prevIds, nextIds);

    if (pendingPin != null) {
      const sameAsCapture =
        pendingPin.prevMessageIds.length === nextIds.length &&
        pendingPin.prevMessageIds.every((id, i) => id === nextIds[i]);
      if (!sameAsCapture) {
        activateBranchPin(pendingPin);
        lastIds = [...nextIds];
        commitScrollable();
        return;
      }
      commitScrollable();
      return;
    }

    if (activePin != null) {
      const entry = items.get(activePin.targetId);
      if (entry != null) {
        pinElement(entry.element, activePin.viewportTop);
      }
      lastIds = [...nextIds];
      commitScrollable();
      return;
    }

    if (!openApplied && nextIds.length > 0) {
      applyOpenAt();
      lastIds = [...nextIds];
      commitScrollable();
      return;
    }

    if (change === "empty") {
      mode = autoScroll ? "follow" : "free";
      openApplied = false;
      lastIds = [...nextIds];
      commitScrollable();
      return;
    }

    // Layout pad is CSS — follow line only; new turn just jumps to end.
    if (change === "append") {
      const newAnchor = findFirstNewTurnAnchorId(prevIds, nextIds, turnAnchorIds());
      if (newAnchor != null) {
        scrollToEndFree();
      } else if (mode === "follow" && autoScroll) {
        scrollToPosition(getMaxScrollTop(viewport), "auto");
      }
    } else if (change === "replace") {
      mode = "free";
      preserveSharedPrefix(prevIds, nextIds);
    } else if (change === "same") {
      if (mode === "follow" && autoScroll) {
        scrollToPosition(getMaxScrollTop(viewport), "auto");
      }
    }

    lastIds = [...nextIds];
    commitScrollable();
  };

  const scheduleReconcile = () => {
    if (reconcileRaf !== 0) {
      return;
    }
    reconcileRaf = window.requestAnimationFrame(() => {
      reconcileRaf = 0;
      reconcileNow();
    });
  };

  const bindObservers = () => {
    contentRo?.disconnect();
    viewportRo?.disconnect();
    contentRo = null;
    viewportRo = null;
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    if (content != null) {
      contentRo = new ResizeObserver(() => {
        scheduleReconcile();
      });
      contentRo.observe(content);
    }
    if (viewport != null) {
      viewportRo = new ResizeObserver(() => {
        scheduleReconcile();
      });
      viewportRo.observe(viewport);
    }
  };

  return {
    setViewport(element) {
      viewport = element;
      if (element != null) {
        lastScrollTop = element.scrollTop;
      }
      bindObservers();
      scheduleReconcile();
    },
    setContent(element) {
      content = element;
      bindObservers();
      scheduleReconcile();
    },
    registerItem(messageId, element, options) {
      const resolved = resolveItemOptions(options);
      items.set(messageId, {
        element,
        turnAnchor: resolved.turnAnchor,
        pathMember: resolved.pathMember,
      });
      element.dataset.messageId = messageId;
      if (resolved.turnAnchor) {
        element.dataset.turnAnchor = "true";
      } else {
        delete element.dataset.turnAnchor;
      }
      if (resolved.pathMember) {
        delete element.dataset.chatMeta;
      } else {
        element.dataset.chatMeta = "";
      }
      scheduleReconcile();
    },
    unregisterItem(messageId, element) {
      const current = items.get(messageId);
      if (current?.element === element) {
        items.delete(messageId);
      }
      scheduleReconcile();
    },
    captureBranchPin(messageId, fromIndexInPath, prevMessageIds) {
      if (viewport == null) {
        return null;
      }
      const entry = items.get(messageId);
      if (entry == null) {
        return null;
      }
      const requestId = nextRequestId;
      nextRequestId += 1;
      return {
        requestId,
        fromMessageId: messageId,
        fromIndexInPath,
        viewportTop: getElementViewportTop(entry.element, viewport),
        prevMessageIds: [...prevMessageIds],
      };
    },
    beginBranchPin(capture) {
      pendingPin = capture;
      mode = "branch-pin";
      scheduleReconcile();
    },
    reconcile() {
      reconcileNow();
    },
    scrollToEnd(behavior = "smooth") {
      doScrollToEnd(behavior);
    },
    handleUserScrollIntent() {
      if (suppressUserIntent) {
        return;
      }
      if (mode !== "branch-pin") {
        mode = "free";
      }
      activePin = null;
      pendingPin = null;
      commitScrollable();
    },
    handleViewportScroll() {
      if (viewport == null) {
        return;
      }
      const top = viewport.scrollTop;
      const scrolledUp = top < lastScrollTop - SCROLL_POSITION_EPSILON_PX;
      const scrolledDown = top > lastScrollTop + SCROLL_POSITION_EPSILON_PX;
      lastScrollTop = top;
      if (!suppressUserIntent && scrolledUp && mode === "follow") {
        mode = "free";
      }
      // Re-arm only when the user scrolls down onto the live edge — not after
      // programmatic scrollToEndFree (new turn stays free for streaming).
      if (!suppressUserIntent && autoScroll && mode === "free" && scrolledDown) {
        const max = getMaxScrollTop(viewport);
        if (max > edgeThreshold && isAtScrollLiveEdge(viewport, edgeThreshold)) {
          mode = "follow";
        }
      }
      commitScrollable();
    },
    subscribeScrollable(listener) {
      scrollableListeners.add(listener);
      return () => {
        scrollableListeners.delete(listener);
      };
    },
    getScrollableSnapshot() {
      return scrollable;
    },
    dispose() {
      contentRo?.disconnect();
      viewportRo?.disconnect();
      if (reconcileRaf !== 0) {
        window.cancelAnimationFrame(reconcileRaf);
      }
      if (pinRaf !== 0) {
        window.cancelAnimationFrame(pinRaf);
      }
      scrollableListeners.clear();
      items.clear();
    },
  };
}
