import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type ClipboardEvent,
} from "react";
import { cn } from "@/lib/cn";
import {
  applyPlainTextPaste,
  applyPhysicalEnter,
  joinPlainTextDocument,
  normalizeEditorDom,
  readCaretPositionFromEditor,
  readPhysicalLinesFromEditor,
  readSelectionSnapshotFromEditor,
  setLogicalSelection,
  splitPlainTextDocument,
  writePhysicalLinesToEditor,
  type PlainTextEditorLineClasses,
} from "./plain-text-editor-dom";
import type { PlainTextEditorCaretPosition, PlainTextEditorSelectionSnapshot } from "./types";

const editorScrollClass = cn("min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto");

const editorSurfaceClass = cn(
  "grid w-full auto-rows-[minmax(min-content,auto)] grid-cols-[max-content_minmax(0,1fr)]",
  "content-start gap-x-pte-gutter counter-reset-pte-line",
  "p-4 font-mono text-sm text-app-foreground outline-none",
);

const plainTextEditorLineRowClass = cn(
  "col-span-full grid min-h-pte-line grid-cols-subgrid items-baseline leading-pte-line",
  "counter-increment-pte-line",
  "before:col-start-1 before:self-baseline before:text-right before:leading-pte-line",
  "before:whitespace-nowrap before:text-pte-line-number before:tabular-nums before:select-none",
  "before:content-counter-pte-line",
);

const lineContentClass = cn(
  "col-start-2 min-h-pte-line min-w-0 self-baseline leading-pte-line",
  "wrap-break-word whitespace-pre-wrap",
);

export type PlainTextEditorHandle = {
  focus: () => void;
  restoreSelection: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  getCaret: () => PlainTextEditorCaretPosition | null;
};

export type PlainTextEditorProps = {
  ref?: React.Ref<PlainTextEditorHandle>;
  defaultValue?: string;
  value?: string;
  onChange?: (next: string) => void;
  active?: boolean;
  selectionSnapshot?: PlainTextEditorSelectionSnapshot | null;
  onSelectionSnapshotChange?: (snapshot: PlainTextEditorSelectionSnapshot | null) => void;
  onCaretChange?: (caret: PlainTextEditorCaretPosition) => void;
  "aria-label"?: string;
};

export function PlainTextEditor({
  ref,
  defaultValue = "",
  value,
  onChange,
  active = false,
  selectionSnapshot = null,
  onSelectionSnapshotChange,
  onCaretChange,
  "aria-label": ariaLabel = "纯文本编辑器",
}: PlainTextEditorProps) {
  const isControlled = value !== undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<string[]>([]);
  const seededRef = useRef(false);
  const caretFrameRef = useRef<number | null>(null);
  const selectionSnapshotRef = useRef(selectionSnapshot);
  const wasActiveRef = useRef(active);

  selectionSnapshotRef.current = selectionSnapshot;

  const lineClasses = useMemo<PlainTextEditorLineClasses>(
    () => ({
      lineRowClass: plainTextEditorLineRowClass,
      lineContentClass,
    }),
    [],
  );

  const syncDomFromLines = useCallback(
    (nextLines: string[]) => {
      const root = rootRef.current;
      if (!root) {
        return;
      }
      writePhysicalLinesToEditor(root, nextLines, lineClasses);
    },
    [lineClasses],
  );

  useEffect(() => {
    if (seededRef.current) {
      return;
    }
    seededRef.current = true;
    const seedText = isControlled ? (value ?? "") : defaultValue;
    linesRef.current = splitPlainTextDocument(seedText);
    syncDomFromLines(linesRef.current);
  }, [defaultValue, isControlled, syncDomFromLines, value]);

  useEffect(() => {
    if (!isControlled) {
      return;
    }
    const nextLines = splitPlainTextDocument(value ?? "");
    const hasChanged =
      nextLines.length !== linesRef.current.length ||
      nextLines.some((line, index) => line !== linesRef.current[index]);
    if (!hasChanged) {
      return;
    }
    linesRef.current = nextLines;
    syncDomFromLines(nextLines);
  }, [isControlled, syncDomFromLines, value]);

  const publishCaretPosition = useCallback(() => {
    const root = rootRef.current;
    if (!root || document.activeElement !== root) {
      return;
    }
    const snapshot = readSelectionSnapshotFromEditor(root);
    if (snapshot) {
      onSelectionSnapshotChange?.(snapshot);
    }
    const position = readCaretPositionFromEditor(root);
    if (position) {
      onCaretChange?.(position);
    }
  }, [onCaretChange, onSelectionSnapshotChange]);

  const scheduleCaretPositionPublish = useCallback(() => {
    if (caretFrameRef.current !== null) {
      return;
    }
    caretFrameRef.current = window.requestAnimationFrame(() => {
      caretFrameRef.current = null;
      publishCaretPosition();
    });
  }, [publishCaretPosition]);

  const clearScheduledCaretPublish = useCallback(() => {
    if (caretFrameRef.current === null) {
      return;
    }
    window.cancelAnimationFrame(caretFrameRef.current);
    caretFrameRef.current = null;
  }, []);

  const commitFromDom = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    normalizeEditorDom(root, lineClasses);
    const next = readPhysicalLinesFromEditor(root);
    const hasChanged =
      next.length !== linesRef.current.length ||
      next.some((line, index) => line !== linesRef.current[index]);
    if (hasChanged) {
      linesRef.current = next;
      const joined = joinPlainTextDocument(next);
      onChange?.(joined);
    }
    publishCaretPosition();
  }, [lineClasses, onChange, publishCaretPosition]);

  useEffect(() => {
    const onSelectionChange = () => {
      scheduleCaretPositionPublish();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      clearScheduledCaretPublish();
    };
  }, [clearScheduledCaretPublish, scheduleCaretPositionPublish]);

  const publishDocument = useCallback(
    (nextLines: string[]) => {
      linesRef.current = nextLines;
      const joined = joinPlainTextDocument(nextLines);
      onChange?.(joined);
      publishCaretPosition();
    },
    [onChange, publishCaretPosition],
  );

  const restoreSelection = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    root.focus();
    if (selectionSnapshotRef.current) {
      setLogicalSelection(root, selectionSnapshotRef.current);
      publishCaretPosition();
      return;
    }
    publishCaretPosition();
  }, [publishCaretPosition]);

  useLayoutEffect(() => {
    const shouldRestore = active && !wasActiveRef.current;
    wasActiveRef.current = active;
    if (!shouldRestore) {
      return;
    }
    restoreSelection();
  }, [active, restoreSelection]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        rootRef.current?.focus();
      },
      restoreSelection,
      getValue: () => joinPlainTextDocument(linesRef.current),
      setValue: (nextValue: string) => {
        const nextLines = splitPlainTextDocument(nextValue);
        linesRef.current = nextLines;
        const root = rootRef.current;
        if (!root) {
          return;
        }
        writePhysicalLinesToEditor(root, nextLines, lineClasses);
        publishCaretPosition();
      },
      getCaret: () => {
        const root = rootRef.current;
        if (!root) {
          return null;
        }
        return readCaretPositionFromEditor(root);
      },
    }),
    [lineClasses, publishCaretPosition, restoreSelection],
  );

  return (
    <div className={editorScrollClass}>
      <div
        ref={rootRef}
        className={editorSurfaceClass}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        suppressContentEditableWarning
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) {
            return;
          }
          event.preventDefault();
          const root = rootRef.current;
          if (!root) {
            return;
          }
          const next = applyPhysicalEnter(root, lineClasses);
          publishDocument(next);
        }}
        onInput={() => {
          commitFromDom();
        }}
        onBlur={() => {
          commitFromDom();
        }}
        onPaste={(event: ClipboardEvent<HTMLDivElement>) => {
          event.preventDefault();
          const root = rootRef.current;
          if (!root) {
            return;
          }
          const pasted = event.clipboardData.getData("text/plain");
          if (pasted.length === 0) {
            return;
          }
          applyPlainTextPaste(root, pasted, lineClasses);
          const next = readPhysicalLinesFromEditor(root);
          publishDocument(next);
        }}
      />
    </div>
  );
}
