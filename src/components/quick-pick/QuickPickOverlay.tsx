import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { quickPickDismissLayerClass, quickPickPanelClass } from "./quick-pick-chrome";

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
          {children}
        </motion.div>
      </>
    </AnimatePresence>,
    document.body,
  );
}
