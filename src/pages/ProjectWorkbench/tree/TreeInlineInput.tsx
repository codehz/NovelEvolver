import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "#app/lib/cn";

type TreeInlineInputProps = {
  ariaLabel: string;
  initialValue?: string;
  placeholder?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
};

export function TreeInlineInput({
  ariaLabel,
  initialValue = "",
  placeholder,
  onCancel,
  onConfirm,
}: TreeInlineInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resolvedRef = useRef(false);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  const submit = useCallback(() => {
    if (resolvedRef.current) {
      return;
    }
    resolvedRef.current = true;
    const trimmed = value.trim();
    if (trimmed === "") {
      onCancel();
      return;
    }
    onConfirm(trimmed);
  }, [onCancel, onConfirm, value]);

  const cancel = useCallback(() => {
    if (resolvedRef.current) {
      return;
    }
    resolvedRef.current = true;
    onCancel();
  }, [onCancel]);

  return (
    <input
      ref={inputRef}
      aria-label={ariaLabel}
      autoComplete="off"
      className={cn(
        "h-5 min-w-0 flex-1 rounded-sm border border-badge-background bg-workbench-editor px-1 text-xs leading-none text-app-foreground outline-none app-region-no-drag",
      )}
      placeholder={placeholder}
      spellCheck={false}
      type="text"
      value={value}
      onBlur={() => submit()}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        }
      }}
    />
  );
}
