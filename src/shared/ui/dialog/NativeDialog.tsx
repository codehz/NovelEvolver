import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { useDialogLifecycle } from "./dialog-lifecycle";

type NativeDialogRequestCloseContextValue = {
  requestClose: (afterClose?: () => void) => void;
};

const NativeDialogRequestCloseContext = createContext<NativeDialogRequestCloseContextValue | null>(
  null,
);

export function useNativeDialogRequestClose(): NativeDialogRequestCloseContextValue["requestClose"] {
  const value = useContext(NativeDialogRequestCloseContext);
  if (value == null) {
    throw new Error("useNativeDialogRequestClose must be used within NativeDialog");
  }
  return value.requestClose;
}

export type NativeDialogProps = Omit<
  ComponentPropsWithoutRef<"dialog">,
  "open" | "children" | "onClose" | "onCancel"
> & {
  open: boolean;
  onDismiss: () => void;
  children: ReactNode;
  /** 点击 backdrop（dialog 自身）时关闭，默认 true */
  closeOnBackdropClick?: boolean;
};

/**
 * 基于原生 `<dialog showModal()>` 的通用模态框。
 * 打开时 `showModal()`，关闭走 `close()` + 与 popover 同款退出过渡后再 `onDismiss`。
 */
export function NativeDialog({
  open,
  onDismiss,
  children,
  className,
  closeOnBackdropClick = true,
  onClick,
  ...rest
}: NativeDialogProps): ReactElement | null {
  if (!open) {
    return null;
  }

  return (
    <NativeDialogShell
      className={className}
      closeOnBackdropClick={closeOnBackdropClick}
      onClick={onClick}
      onDismiss={onDismiss}
      {...rest}
    >
      {children}
    </NativeDialogShell>
  );
}

function NativeDialogShell({
  onDismiss,
  children,
  className,
  closeOnBackdropClick = true,
  onClick,
  ...rest
}: Omit<NativeDialogProps, "open">) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const { requestClose } = useDialogLifecycle(dialogRef, onDismiss);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDialogElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || !closeOnBackdropClick) {
        return;
      }
      if (event.target === event.currentTarget) {
        requestClose();
      }
    },
    [closeOnBackdropClick, onClick, requestClose],
  );

  return (
    <NativeDialogRequestCloseContext.Provider value={{ requestClose }}>
      <dialog
        ref={dialogRef}
        className={cn(nativeDialogBaseClass, className)}
        onClick={handleClick}
        {...rest}
      >
        {children}
      </dialog>
    </NativeDialogRequestCloseContext.Provider>
  );
}

const nativeDialogBaseClass = cn(
  "m-auto max-h-[calc(100vh-5rem)] max-w-[calc(100vw-3rem)] border-0 bg-transparent p-0 text-inherit shadow-none outline-none",
  "opacity-0 transition transition-discrete duration-220 ease-[cubic-bezier(0.33,1,0.68,1)]",
  "open:opacity-100",
  "open:starting:opacity-0",
  "backdrop:bg-ctp-crust/55 backdrop:opacity-0 backdrop:transition backdrop:transition-discrete backdrop:duration-220",
  "open:backdrop:opacity-100",
  "open:starting:backdrop:opacity-0",
);
