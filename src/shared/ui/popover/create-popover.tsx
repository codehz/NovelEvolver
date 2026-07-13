import { mergeRefs } from "foxact/merge-refs";
import { createPolymorphic, type PolymorphicComponentProps } from "foxact/polymorphic";
import {
  createContext,
  useContext,
  useRef,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";

import { usePopoverPanelLifecycle } from "./popover-lifecycle";

const { renderPolymorphic } = createPolymorphic("as");

type PopoverRequestCloseContextValue = {
  requestClose: (afterClose: () => void) => void;
};

type PopoverTargetOwnProps = {
  popover?: "auto" | "manual" | "hint";
  children?: ReactNode;
};

type PopoverTargetProps<T extends ElementType = "div"> = PolymorphicComponentProps<
  "as",
  T,
  PopoverTargetOwnProps
>;

export type CreatePopoverResult = [
  PopoverProvider: (props: {
    onDismiss: () => void;
    openOnMount?: boolean;
    children: ReactNode;
  }) => ReactElement,
  PopoverTarget: <T extends ElementType = "div">(props: PopoverTargetProps<T>) => ReactElement,
  PopoverContent: (props: { children: ReactNode }) => ReactElement,
  usePopoverRequestClose: () => PopoverRequestCloseContextValue["requestClose"],
];

/**
 * Portal 风格的三段式 Popover API：`Provider` 管理生命周期与 `requestClose`，
 * `Target` 承载原生 `popover` 属性并支持多态 `as`，`Content` 作为内容插槽。
 *
 * @see https://foxact.skk.moe/polymorphic
 */
export function createPopover(displayName: string): CreatePopoverResult {
  const PopoverRequestCloseContext = createContext<PopoverRequestCloseContextValue | null>(null);
  const PopoverPanelRefContext = createContext<React.RefObject<HTMLElement | null> | null>(null);

  function usePopoverRequestClose(): PopoverRequestCloseContextValue["requestClose"] {
    const value = useContext(PopoverRequestCloseContext);
    if (value == null) {
      throw new Error(`usePopoverRequestClose must be used within ${displayName}.PopoverProvider`);
    }
    return value.requestClose;
  }

  function PopoverProvider({
    onDismiss,
    openOnMount = true,
    children,
  }: {
    onDismiss: () => void;
    openOnMount?: boolean;
    children: ReactNode;
  }) {
    const panelRef = useRef<HTMLElement | null>(null);
    const { requestClose } = usePopoverPanelLifecycle(panelRef, onDismiss, openOnMount);

    return (
      <PopoverPanelRefContext.Provider value={panelRef}>
        <PopoverRequestCloseContext.Provider value={{ requestClose }}>
          {children}
        </PopoverRequestCloseContext.Provider>
      </PopoverPanelRefContext.Provider>
    );
  }

  function PopoverTarget<T extends ElementType = "div">(props: PopoverTargetProps<T>) {
    const panelRef = useContext(PopoverPanelRefContext);
    if (panelRef == null) {
      throw new Error(
        `${displayName}.PopoverTarget must be used within ${displayName}.PopoverProvider`,
      );
    }

    const { as, popover = "auto", ref: forwardedRef, children, ...rest } = props;
    const mergedRef = mergeRefs(panelRef, forwardedRef);

    return renderPolymorphic({
      defaultComponent: "div",
      ref: mergedRef,
      props: {
        ...rest,
        as,
        popover,
        ref: mergedRef,
        children,
      },
    }) as ReactElement;
  }

  function PopoverContent({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }

  if (import.meta.env.DEV) {
    PopoverProvider.displayName = `${displayName}.PopoverProvider`;
    PopoverTarget.displayName = `${displayName}.PopoverTarget`;
    PopoverContent.displayName = `${displayName}.PopoverContent`;
  }

  return [PopoverProvider, PopoverTarget, PopoverContent, usePopoverRequestClose];
}
