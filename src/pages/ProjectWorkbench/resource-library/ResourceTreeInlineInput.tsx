import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "#app/lib/cn";

type ResourceTreeInlineInputProps = {
  mode: "creating" | "renaming";
  kind: "file" | "folder";
  initialValue?: string;
  onCancel: () => void;
  onConfirm: (name: string) => void;
};

export function ResourceTreeInlineInput({
  mode,
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
      aria-label={
        mode === "creating"
          ? kind === "file"
            ? "新文件名"
            : "新文件夹名"
          : kind === "file"
            ? "重命名文件"
            : "重命名文件夹"
      }
      autoComplete="off"
      className={cn(
        "h-5 min-w-0 flex-1 rounded-sm border border-badge-background bg-workbench-editor px-1 text-xs leading-none text-app-foreground outline-none app-region-no-drag",
      )}
      placeholder={
        mode === "creating"
          ? kind === "file"
            ? "例如 设定/世界观.md"
            : "例如 设定/资料"
          : undefined
      }
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
