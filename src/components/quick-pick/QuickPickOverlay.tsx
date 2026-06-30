import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  quickPickDismissLayerClass,
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
  dismissAriaLabel,
  onDismiss,
  children,
}: {
  titleId: string;
  dismissAriaLabel: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onDismiss]);

  const contentRef = useRef<HTMLDivElement>(null);
  const { shellHeightPx } = useQuickPickPanelHeightAnimation(contentRef);

  return createPortal(
    <AnimatePresence>
      <>
        <button
          aria-label={dismissAriaLabel}
          className={quickPickDismissLayerClass}
          type="button"
          onClick={onDismiss}
        />
        <motion.div
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
      </>
    </AnimatePresence>,
    document.body,
  );
}
