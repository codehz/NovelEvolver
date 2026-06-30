import { useCallback, useEffect, useRef, type ReactNode } from "react";

import {
  quickPickPanelClass,
  quickPickPanelContentClass,
  quickPickPanelHeightShellClass,
} from "./quick-pick-chrome";
import { QuickPickOverlayContext } from "./quick-pick-overlay-context";
import { useQuickPickPanelHeightAnimation } from "./use-quick-pick-panel-height-animation";

const QUICK_PICK_POPOVER_TRANSITION_MS = 220;

function scheduleAfterPopoverCloseTransition(popoverEl: HTMLElement, onFinished: () => void): void {
  let settled = false;
  const finish = () => {
    if (settled) {
      return;
    }
    settled = true;
    popoverEl.removeEventListener("transitionend", onTransitionEnd);
    onFinished();
  };
  function onTransitionEnd(transitionEvent: TransitionEvent) {
    if (transitionEvent.target !== popoverEl) {
      return;
    }
    if (
      transitionEvent.propertyName === "opacity" ||
      transitionEvent.propertyName === "transform"
    ) {
      finish();
    }
  }
  popoverEl.addEventListener("transitionend", onTransitionEnd);
  window.setTimeout(finish, QUICK_PICK_POPOVER_TRANSITION_MS + 40);
}

export function QuickPickOverlay({
  titleId,
  onDismiss,
  children,
}: {
  titleId: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingAfterCloseRef = useRef<(() => void) | null>(null);
  const isClosingRef = useRef(false);
  const { shellHeightPx } = useQuickPickPanelHeightAnimation(contentRef);

  const requestClose = useCallback((afterClose: () => void) => {
    const panel = panelRef.current;
    if (panel == null || isClosingRef.current) {
      return;
    }
    pendingAfterCloseRef.current = afterClose;
    if (panel.matches(":popover-open")) {
      isClosingRef.current = true;
      panel.hidePopover();
      return;
    }
    pendingAfterCloseRef.current = null;
    afterClose();
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (panel == null) {
      return;
    }
    if (!panel.matches(":popover-open")) {
      panel.showPopover();
    }
    return () => {
      if (panel.matches(":popover-open")) {
        panel.hidePopover();
      }
    };
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (panel == null) {
      return;
    }
    const popoverEl = panel;
    function onToggle(event: ToggleEvent) {
      if (event.newState !== "closed") {
        return;
      }
      const afterClose = pendingAfterCloseRef.current;
      pendingAfterCloseRef.current = null;
      scheduleAfterPopoverCloseTransition(popoverEl, () => {
        isClosingRef.current = false;
        if (afterClose != null) {
          afterClose();
        } else {
          onDismiss();
        }
      });
    }
    popoverEl.addEventListener("toggle", onToggle);
    return () => {
      popoverEl.removeEventListener("toggle", onToggle);
    };
  }, [onDismiss]);

  return (
    <QuickPickOverlayContext.Provider value={{ requestClose }}>
      <div
        ref={panelRef}
        popover="auto"
        aria-labelledby={titleId}
        className={quickPickPanelClass}
        role="dialog"
      >
        <div
          className={quickPickPanelHeightShellClass}
          style={shellHeightPx != null ? { height: shellHeightPx } : undefined}
        >
          <div ref={contentRef} className={quickPickPanelContentClass}>
            {children}
          </div>
        </div>
      </div>
    </QuickPickOverlayContext.Provider>
  );
}
