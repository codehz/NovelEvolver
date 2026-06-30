import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

import {
  floatingPickerDismissLayerClass,
  floatingPickerPanelBaseClass,
  floatingPickerPanelCenteredClass,
} from "./floating-picker-chrome";

const defaultPanelMotion = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.85 },
};

export type FloatingPickerShellProps = {
  open: boolean;
  onClose: () => void;
  /** 与 `aria-labelledby` 指向的可见或 sr-only 标题元素 id 一致。 */
  titleId: string;
  dismissAriaLabel: string;
  children: ReactNode;
  /** 目前仅支持标题栏下居中；锚定定位由调用方通过 `panelClassName` 组合。 */
  position?: "centered";
  panelClassName?: string;
};

export function FloatingPickerShell({
  open,
  onClose,
  titleId,
  dismissAriaLabel,
  children,
  position = "centered",
  panelClassName,
}: FloatingPickerShellProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  const positionClass = position === "centered" ? floatingPickerPanelCenteredClass : null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <button
            aria-label={dismissAriaLabel}
            className={floatingPickerDismissLayerClass}
            type="button"
            onClick={onClose}
          />
          <motion.div
            aria-labelledby={titleId}
            className={cn(floatingPickerPanelBaseClass, positionClass, panelClassName)}
            role="dialog"
            initial={defaultPanelMotion.initial}
            animate={defaultPanelMotion.animate}
            exit={defaultPanelMotion.exit}
            transition={defaultPanelMotion.transition}
          >
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
