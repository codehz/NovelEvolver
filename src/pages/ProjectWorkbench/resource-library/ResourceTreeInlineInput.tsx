import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "#app/lib/cn";

type ResourceTreeInlineInputProps = {
  kind: "file" | "folder";
  initialValue?: string;
  onCancel: () => void;
  onConfirm: (name: string) => void;
};

export function ResourceTreeInlineInput({
  kind,
  initialValue = "",
  onCancel,
  onConfirm,
}: ResourceTreeInlineInputProps) {
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
      aria-label={kind === "file" ? "新文件名" : "新文件夹名"}
      autoComplete="off"
      className={cn(
        "min-w-0 flex-1 rounded-sm border border-badge-background bg-workbench-editor px-1 py-0 text-xs leading-tight text-app-foreground outline-none app-region-no-drag",
      )}
      placeholder={kind === "file" ? "例如 设定/世界观.md" : "例如 设定/资料"}
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
