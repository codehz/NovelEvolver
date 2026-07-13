import { useCallback, useEffect, useRef, type RefObject } from "react";

export const POPOVER_CLOSE_TRANSITION_MS = 220;

export function scheduleAfterPopoverCloseTransition(
  popoverEl: HTMLElement,
  onFinished: () => void,
): void {
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
  window.setTimeout(finish, POPOVER_CLOSE_TRANSITION_MS + 40);
}

export function usePopoverPanelLifecycle(
  panelRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  openOnMount = true,
): {
  requestClose: (afterClose: () => void) => void;
} {
  const pendingAfterCloseRef = useRef<(() => void) | null>(null);
  const isClosingRef = useRef(false);

  const requestClose = useCallback(
    (afterClose: () => void) => {
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
    },
    [panelRef],
  );

  useEffect(() => {
    const panel = panelRef.current;
    if (panel == null) {
      return;
    }
    if (openOnMount && !panel.matches(":popover-open")) {
      panel.showPopover();
    }
    return () => {
      if (panel.matches(":popover-open")) {
        panel.hidePopover();
      }
    };
  }, [openOnMount, panelRef]);

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
  }, [onDismiss, panelRef]);

  return { requestClose };
}
