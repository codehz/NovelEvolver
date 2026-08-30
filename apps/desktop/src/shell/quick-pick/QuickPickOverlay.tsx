import { Dialog } from "@base-ui/react/dialog";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { quickPickPanelClass, quickPickPanelContentClass } from "./quick-pick-chrome";

type RequestClose = (afterClose: () => void) => void;

type QuickPickOverlayContextValue = {
  open: boolean;
  requestClose: RequestClose;
};

const QuickPickOverlayContext = createContext<QuickPickOverlayContextValue | null>(null);

export function useQuickPickRequestClose(): RequestClose {
  const value = useContext(QuickPickOverlayContext);
  if (value == null) {
    throw new Error("useQuickPickRequestClose must be used within QuickPickOverlay");
  }
  return value.requestClose;
}

/** Dialog open state for nested Base UI Combobox (`inline` + bound `open`). */
export function useQuickPickOverlayOpen(): boolean {
  const value = useContext(QuickPickOverlayContext);
  if (value == null) {
    throw new Error("useQuickPickOverlayOpen must be used within QuickPickOverlay");
  }
  return value.open;
}

type QuickPickOverlayProps = {
  titleId: string;
  onDismiss: () => void;
  children: ReactNode;
};

export function QuickPickOverlay({ titleId, onDismiss, children }: QuickPickOverlayProps) {
  // Base UI only applies `data-starting-style` on false→true open transitions.
  // Mounting with open=true skips the enter animation entirely.
  const [open, setOpen] = useState(false);
  const pendingAfterCloseRef = useRef<(() => void) | null>(null);
  const settledRef = useRef(false);

  useLayoutEffect(() => {
    if (settledRef.current) {
      return;
    }
    setOpen(true);
  }, []);

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
    // First writer wins: selection may queue resolve, then Combobox onOpenChange
    // queues dismiss — keep the resolve callback.
    if (pendingAfterCloseRef.current == null) {
      pendingAfterCloseRef.current = afterClose;
    }
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

  const contextValue = useMemo(
    () => ({
      open,
      requestClose,
    }),
    [open, requestClose],
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      <Dialog.Portal>
        <QuickPickOverlayContext value={contextValue}>
          <Dialog.Popup
            className={quickPickPanelClass}
            aria-labelledby={titleId}
            finalFocus={false}
          >
            <div className={quickPickPanelContentClass}>{children}</div>
          </Dialog.Popup>
        </QuickPickOverlayContext>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
