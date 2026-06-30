import { type ReactNode, type RefObject } from "react";

import { floatingPickerListClass } from "./floating-picker-chrome";

export type FloatingPickerListboxProps = {
  listboxId: string;
  listRef: RefObject<HTMLUListElement | null>;
  ariaLabel: string;
  children: ReactNode;
};

export function FloatingPickerListbox({
  listboxId,
  listRef,
  ariaLabel,
  children,
}: FloatingPickerListboxProps) {
  return (
    <ul
      ref={listRef}
      id={listboxId}
      className={floatingPickerListClass}
      role="listbox"
      aria-label={ariaLabel}
    >
      {children}
    </ul>
  );
}
