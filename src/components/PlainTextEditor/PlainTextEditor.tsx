import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type ClipboardEvent,
} from "react";
import { ScrollArea } from "@/components/ScrollArea";
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
  syncCurrentLineHighlight,
  writePhysicalLinesToEditor,
  type PlainTextEditorLineClasses,
} from "./plain-text-editor-dom";
import type { PlainTextEditorCaretPosition, PlainTextEditorSelectionSnapshot } from "./types";

const editorRootClass = cn("min-h-0 min-w-0 flex-1");

const editorSurfaceClass = cn(
  "grid w-full auto-rows-[minmax(min-content,auto)] grid-cols-[max-content_minmax(0,1fr)]",
  "content-start gap-x-pte-gutter counter-reset-pte-line",
  "font-mono text-sm text-app-foreground outline-none",
);

const plainTextEditorLineRowClass = cn(
  "col-span-full grid min-h-pte-line grid-cols-subgrid items-baseline px-3 leading-pte-line",
  "counter-increment-pte-line",
  "data-pte-current-line:bg-pte-line-highlight",
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
  /** 仅用于初次挂载；之后由组件内部 DOM 持有文稿。 */
  defaultValue?: string;
  /** 可选；父组件若不需要同步文稿，请勿传入以避免额外更新。 */
  onChange?: (next: string) => void;
  active?: boolean;
  selectionSnapshot?: PlainTextEditorSelectionSnapshot | null;
  onSelectionSnapshotChange?: (snapshot: PlainTextEditorSelectionSnapshot | null) => void;
  onCaretChange?: (caret: PlainTextEditorCaretPosition) => void;
  highlightCurrentLine?: boolean;
  "aria-label"?: string;
};

export function PlainTextEditor({
  ref,
  defaultValue = "",
  onChange,
  active = false,
  selectionSnapshot = null,
  onSelectionSnapshotChange,
  onCaretChange,
  highlightCurrentLine = true,
  "aria-label": ariaLabel = "纯文本编辑器",
}: PlainTextEditorProps) {
  const initialDefaultRef = useRef(defaultValue);
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
    linesRef.current = splitPlainTextDocument(initialDefaultRef.current);
    syncDomFromLines(linesRef.current);
  }, [syncDomFromLines]);

  const publishCaretPosition = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    if (document.activeElement !== root) {
      if (highlightCurrentLine) {
        syncCurrentLineHighlight(root, null, false);
      }
      return;
    }
    const snapshot = readSelectionSnapshotFromEditor(root);
    if (snapshot) {
      onSelectionSnapshotChange?.(snapshot);
      if (highlightCurrentLine) {
        syncCurrentLineHighlight(root, snapshot.focus.lineIndex, true);
      }
    } else if (highlightCurrentLine) {
      syncCurrentLineHighlight(root, null, false);
    }
    const position = readCaretPositionFromEditor(root);
    if (position) {
      onCaretChange?.(position);
    }
  }, [highlightCurrentLine, onCaretChange, onSelectionSnapshotChange]);

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
    <ScrollArea className={editorRootClass} fill>
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
          const root = rootRef.current;
          if (root && highlightCurrentLine) {
            syncCurrentLineHighlight(root, null, false);
          }
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
    </ScrollArea>
  );
}
