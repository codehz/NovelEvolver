import { useCallback, useEffect, useRef, type RefObject } from "react";

import {
  POPOVER_CLOSE_TRANSITION_MS,
  scheduleAfterPopoverCloseTransition,
} from "#app/shared/ui/popover";

export const DIALOG_CLOSE_TRANSITION_MS = POPOVER_CLOSE_TRANSITION_MS;

export const scheduleAfterDialogCloseTransition = scheduleAfterPopoverCloseTransition;

export function useDialogLifecycle(
  dialogRef: RefObject<HTMLDialogElement | null>,
  onDismiss: () => void,
): {
  requestClose: (afterClose?: () => void) => void;
} {
  const pendingAfterCloseRef = useRef<(() => void) | null>(null);
  const isClosingRef = useRef(false);

  const requestClose = useCallback(
    (afterClose?: () => void) => {
      const dialog = dialogRef.current;
      if (dialog == null || isClosingRef.current) {
        return;
      }
      const finish = afterClose ?? onDismiss;
      pendingAfterCloseRef.current = finish;
      if (dialog.open) {
        isClosingRef.current = true;
        dialog.close();
        return;
      }
      pendingAfterCloseRef.current = null;
      finish();
    },
    [dialogRef, onDismiss],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog == null) {
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [dialogRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog == null) {
      return;
    }
    const dialogEl = dialog;

    function onCancel(event: Event) {
      event.preventDefault();
      requestClose();
    }

    function onClose() {
      const afterClose = pendingAfterCloseRef.current;
      pendingAfterCloseRef.current = null;
      scheduleAfterDialogCloseTransition(dialogEl, () => {
        isClosingRef.current = false;
        if (afterClose != null) {
          afterClose();
        } else {
          onDismiss();
        }
      });
    }

    dialogEl.addEventListener("cancel", onCancel);
    dialogEl.addEventListener("close", onClose);
    return () => {
      dialogEl.removeEventListener("cancel", onCancel);
      dialogEl.removeEventListener("close", onClose);
    };
  }, [dialogRef, onDismiss, requestClose]);

  return { requestClose };
}
