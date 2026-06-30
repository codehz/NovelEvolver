import { motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

import {
  quickPickPanelClass,
  quickPickPanelContentClass,
  quickPickPanelHeightShellClass,
} from "./quick-pick-chrome";
import { useQuickPickPanelHeightAnimation } from "./use-quick-pick-panel-height-animation";

const panelMotion = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.85 },
};

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
  const { shellHeightPx } = useQuickPickPanelHeightAnimation(contentRef);

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
    function onToggle(event: ToggleEvent) {
      if (event.newState === "closed") {
        onDismiss();
      }
    }
    panel.addEventListener("toggle", onToggle);
    return () => {
      panel.removeEventListener("toggle", onToggle);
    };
  }, [onDismiss]);

  return (
    <motion.div
      ref={panelRef}
      popover="auto"
      aria-labelledby={titleId}
      className={quickPickPanelClass}
      role="dialog"
      initial={panelMotion.initial}
      animate={panelMotion.animate}
      exit={panelMotion.exit}
      transition={panelMotion.transition}
    >
      <div
        className={quickPickPanelHeightShellClass}
        style={shellHeightPx != null ? { height: shellHeightPx } : undefined}
      >
        <div ref={contentRef} className={quickPickPanelContentClass}>
          {children}
        </div>
      </div>
    </motion.div>
  );
}
