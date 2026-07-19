import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";

import type { ChatScrollerBranchPinCapture, ChatScrollerOpenAt } from "./chat-scroller-types";
import {
  createChatScrollerController,
  type ChatScrollerController,
} from "./create-chat-scroller-controller";

type ChatScrollerContextValue = {
  controller: ChatScrollerController;
};

const ChatScrollerContext = createContext<ChatScrollerContextValue | null>(null);

function useChatScrollerContext(): ChatScrollerContextValue {
  const ctx = useContext(ChatScrollerContext);
  if (ctx == null) {
    throw new Error("ChatScroller components must be used within ChatScroller.Root");
  }
  return ctx;
}

export function useChatScroller(): {
  captureBranchPin: ChatScrollerController["captureBranchPin"];
  beginBranchPin: ChatScrollerController["beginBranchPin"];
  scrollToEnd: ChatScrollerController["scrollToEnd"];
  reconcile: ChatScrollerController["reconcile"];
} {
  const { controller } = useChatScrollerContext();
  return {
    captureBranchPin: controller.captureBranchPin,
    beginBranchPin: controller.beginBranchPin,
    scrollToEnd: controller.scrollToEnd,
    reconcile: controller.reconcile,
  };
}

type ChatScrollerRootProps = {
  children: ReactNode;
  className?: string;
  autoScroll?: boolean;
  openAt?: ChatScrollerOpenAt;
};

export function ChatScrollerRoot({
  children,
  className,
  autoScroll = true,
  openAt = "last-anchor",
}: ChatScrollerRootProps) {
  const controllerRef = useRef<ChatScrollerController | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current = createChatScrollerController({
      autoScroll,
      openAt,
    });
  }
  const controller = controllerRef.current;

  useEffect(() => {
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [controller]);

  const value = useMemo(() => ({ controller }), [controller]);

  return (
    <ChatScrollerContext.Provider value={value}>
      <div className={className} data-chat-scroller-root="">
        {children}
      </div>
    </ChatScrollerContext.Provider>
  );
}

type ChatScrollerViewportProps = ComponentPropsWithoutRef<"div">;

export function ChatScrollerViewport({
  children,
  className,
  onScroll,
  onWheel,
  onTouchMove,
  onKeyDown,
  "aria-label": ariaLabel = "对话消息",
  ...props
}: ChatScrollerViewportProps) {
  const { controller } = useChatScrollerContext();
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      controller.setViewport(node);
    },
    [controller],
  );

  return (
    <div
      ref={setRef}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      // Size container so last-turn min-height can use 100cqh (layout pad, not JS).
      className={cn("@container-size", className)}
      data-chat-scroller-viewport=""
      onScroll={(event) => {
        controller.handleViewportScroll();
        onScroll?.(event);
      }}
      onWheel={(event) => {
        controller.handleUserScrollIntent();
        onWheel?.(event);
      }}
      onTouchMove={(event) => {
        controller.handleUserScrollIntent();
        onTouchMove?.(event);
      }}
      onKeyDown={(event) => {
        if (
          event.key === "ArrowUp" ||
          event.key === "ArrowDown" ||
          event.key === "PageUp" ||
          event.key === "PageDown" ||
          event.key === "Home" ||
          event.key === "End" ||
          event.key === " "
        ) {
          controller.handleUserScrollIntent();
        }
        onKeyDown?.(event);
      }}
      {...props}
    >
      {children}
    </div>
  );
}

type ChatScrollerContentProps = ComponentPropsWithoutRef<"div">;

export function ChatScrollerContent({
  children,
  className,
  "aria-busy": ariaBusy,
  ...props
}: ChatScrollerContentProps) {
  const { controller } = useChatScrollerContext();
  const setContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      controller.setContent(node);
    },
    [controller],
  );

  useLayoutEffect(() => {
    controller.reconcile();
  });

  return (
    <div
      ref={setContentRef}
      role="log"
      aria-relevant="additions"
      aria-busy={ariaBusy}
      className={cn("relative", className)}
      data-chat-scroller-content=""
      {...props}
    >
      {children}
    </div>
  );
}

type ChatScrollerItemProps = ComponentPropsWithoutRef<"div"> & {
  messageId: string;
  turnAnchor?: boolean;
  /** Exclude from path-change / branch-pin id lists (meta banners, loading). */
  pathMember?: boolean;
};

export function ChatScrollerItem({
  messageId,
  turnAnchor = false,
  pathMember = true,
  className,
  children,
  ...props
}: ChatScrollerItemProps) {
  const { controller } = useChatScrollerContext();
  const elementRef = useRef<HTMLDivElement | null>(null);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (elementRef.current != null && elementRef.current !== node) {
        controller.unregisterItem(messageId, elementRef.current);
      }
      elementRef.current = node;
      if (node != null) {
        controller.registerItem(messageId, node, { turnAnchor, pathMember });
      }
    },
    [controller, messageId, pathMember, turnAnchor],
  );

  useLayoutEffect(() => {
    const node = elementRef.current;
    if (node != null) {
      controller.registerItem(messageId, node, { turnAnchor, pathMember });
    }
    return () => {
      if (elementRef.current != null) {
        controller.unregisterItem(messageId, elementRef.current);
      }
    };
  }, [controller, messageId, pathMember, turnAnchor]);

  return (
    <div
      ref={setRef}
      className={cn("min-w-0 shrink-0 overflow-anchor-none", className)}
      data-message-id={messageId}
      data-turn-anchor={turnAnchor ? "true" : undefined}
      data-chat-meta={pathMember ? undefined : ""}
      {...props}
    >
      {children}
    </div>
  );
}

type ChatScrollerJumpToLatestProps = ComponentPropsWithoutRef<"button">;

export function ChatScrollerJumpToLatest({
  className,
  children,
  onClick,
  ...props
}: ChatScrollerJumpToLatestProps) {
  const { controller } = useChatScrollerContext();
  const scrollable = useSyncExternalStore(
    controller.subscribeScrollable,
    controller.getScrollableSnapshot,
    controller.getScrollableSnapshot,
  );
  const active = scrollable.end;

  return (
    <button
      type="button"
      className={className}
      inert={!active ? true : undefined}
      tabIndex={active ? 0 : -1}
      data-active={active ? "true" : "false"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          controller.scrollToEnd("smooth");
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export const ChatScroller = {
  Root: ChatScrollerRoot,
  Viewport: ChatScrollerViewport,
  Content: ChatScrollerContent,
  Item: ChatScrollerItem,
  JumpToLatest: ChatScrollerJumpToLatest,
};

export type { ChatScrollerBranchPinCapture };
