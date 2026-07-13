import { Dialog } from "@base-ui/react/dialog";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { useAnimatedContentHeight } from "#app/shared/lib/ui/animated-height";

import {
  quickPickPanelClass,
  quickPickPanelContentClass,
  quickPickPanelHeightShellClass,
} from "./quick-pick-chrome";

type RequestClose = (afterClose: () => void) => void;

const QuickPickRequestCloseContext = createContext<RequestClose | null>(null);

export function useQuickPickRequestClose(): RequestClose {
  const value = useContext(QuickPickRequestCloseContext);
  if (value == null) {
    throw new Error("useQuickPickRequestClose must be used within QuickPickOverlay");
  }
  return value;
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
  const [open, setOpen] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingAfterCloseRef = useRef<(() => void) | null>(null);
  const settledRef = useRef(false);
  const { heightPx: shellHeightPx } = useAnimatedContentHeight(contentRef, panelRef);

  const settle = useCallback(() => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    const afterClose = pendingAfterCloseRef.current;
    pendingAfterCloseRef.current = null;
    if (afterClose != null) {
      afterClose();
      return;
    }
    onDismiss();
  }, [onDismiss]);

  const requestClose = useCallback<RequestClose>((afterClose) => {
    if (settledRef.current) {
      return;
    }
    pendingAfterCloseRef.current = afterClose;
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) {
      setOpen(false);
    }
  }, []);

  const handleOpenChangeComplete = useCallback(
    (next: boolean) => {
      if (!next) {
        settle();
      }
    },
    [settle],
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      <Dialog.Portal>
        <QuickPickRequestCloseContext value={requestClose}>
          <Dialog.Popup
            ref={panelRef}
            className={quickPickPanelClass}
            aria-labelledby={titleId}
            finalFocus={false}
          >
            <div
              className={quickPickPanelHeightShellClass}
              style={shellHeightPx != null ? { height: shellHeightPx } : undefined}
            >
              <div ref={contentRef} className={quickPickPanelContentClass}>
                {children}
              </div>
            </div>
          </Dialog.Popup>
        </QuickPickRequestCloseContext>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
