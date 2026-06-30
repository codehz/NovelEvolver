import { type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";

import { floatingPickerInputClass, floatingPickerInputWrapClass } from "./floating-picker-chrome";

export type FloatingPickerSearchFieldProps = {
  titleId: string;
  listboxId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
};

export function FloatingPickerSearchField({
  titleId,
  listboxId,
  inputRef,
  label,
  placeholder,
  value,
  onChange,
  onKeyDown,
}: FloatingPickerSearchFieldProps) {
  const inputId = `${titleId}-input`;

  return (
    <div className={floatingPickerInputWrapClass}>
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        className={floatingPickerInputClass}
        type="text"
        role="combobox"
        aria-expanded
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
