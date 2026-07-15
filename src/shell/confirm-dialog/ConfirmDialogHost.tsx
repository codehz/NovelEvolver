import { Dialog } from "@base-ui/react/dialog";
import { useAtomValue } from "jotai";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import {
  activeConfirmDialogSessionAtom,
  type ConfirmDialogSession,
} from "#app/shared/lib/confirm-dialog";
import { confirmDialogHostApi } from "#app/shared/lib/confirm-dialog/api";
import { Button } from "#app/shared/ui";

import {
  confirmDialogBackdropClass,
  confirmDialogBodyClass,
  confirmDialogDangerConfirmClass,
  confirmDialogDescriptionClass,
  confirmDialogFooterClass,
  confirmDialogPanelClass,
  confirmDialogTitleClass,
} from "./confirm-dialog-chrome";

function ConfirmDialogSessionView({ session }: { session: ConfirmDialogSession }) {
  // Base UI only applies `data-starting-style` on false→true open transitions.
  // Mounting with open=true skips the enter animation entirely.
  const [open, setOpen] = useState(false);
  const pendingResultRef = useRef<boolean | null>(null);
  const settledRef = useRef(false);

  const { requestId, options } = session;
  const tone = options.tone ?? "default";
  const confirmLabel = options.confirmLabel ?? "确定";
  const cancelLabel = options.cancelLabel ?? "取消";
  const isDanger = tone === "danger";

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
    const confirmed = pendingResultRef.current ?? false;
    pendingResultRef.current = null;
    confirmDialogHostApi.resolve(requestId, confirmed);
  }, [requestId]);

  const requestClose = useCallback((confirmed: boolean) => {
    if (settledRef.current) {
      return;
    }
    if (pendingResultRef.current == null) {
      pendingResultRef.current = confirmed;
    }
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        requestClose(false);
      }
    },
    [requestClose],
  );

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
        <Dialog.Backdrop className={confirmDialogBackdropClass} />
        <Dialog.Popup className={confirmDialogPanelClass} finalFocus={false}>
          <div className={confirmDialogBodyClass}>
            <Dialog.Title className={confirmDialogTitleClass}>{options.title}</Dialog.Title>
            {options.description != null && options.description !== "" ? (
              <Dialog.Description className={confirmDialogDescriptionClass}>
                {options.description}
              </Dialog.Description>
            ) : null}
          </div>
          <div className={confirmDialogFooterClass}>
            <Button
              autoFocus={isDanger}
              variant="secondary"
              onClick={() => {
                requestClose(false);
              }}
            >
              {cancelLabel}
            </Button>
            <Button
              autoFocus={!isDanger}
              variant={isDanger ? "secondary" : "primary"}
              className={isDanger ? confirmDialogDangerConfirmClass : undefined}
              onClick={() => {
                requestClose(true);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialogHost() {
  const session = useAtomValue(activeConfirmDialogSessionAtom);
  if (session == null) {
    return null;
  }
  return <ConfirmDialogSessionView key={session.requestId} session={session} />;
}
