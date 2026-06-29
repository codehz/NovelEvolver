import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ClipboardEvent,
} from "react";
import { cn } from "@/lib/cn";
import { setEditorCaretPosition } from "./editor-caret";
import {
  applyPlainTextPaste,
  applyPhysicalEnter,
  joinPlainTextDocument,
  normalizeEditorDom,
  readCaretPositionFromEditor,
  readPhysicalLinesFromEditor,
  splitPlainTextDocument,
  writePhysicalLinesToEditor,
  type PlainTextEditorLineClasses,
} from "./plain-text-editor";

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
  getValue: () => string;
  setValue: (value: string) => void;
  getCaret: () => { line: number; column: number } | null;
};

type PlainTextEditorProps = {
  ref?: React.Ref<PlainTextEditorHandle>;
  defaultValue?: string;
  onChange?: (next: string) => void;
};

export function PlainTextEditor({ ref, defaultValue = "", onChange }: PlainTextEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef(splitPlainTextDocument(defaultValue));
  const mountedRef = useRef(false);
  const caretFrameRef = useRef<number | null>(null);

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
    if (!mountedRef.current) {
      mountedRef.current = true;
      syncDomFromLines(linesRef.current);
    }
  }, [syncDomFromLines]);

  const publishCaretPosition = useCallback(() => {
    const root = rootRef.current;
    if (!root || document.activeElement !== root) {
      return;
    }
    const position = readCaretPositionFromEditor(root);
    if (position) {
      setEditorCaretPosition(position);
    }
  }, []);

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
      onChange?.(joinPlainTextDocument(next));
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

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        rootRef.current?.focus();
      },
      getValue: () => joinPlainTextDocument(linesRef.current),
      setValue: (value: string) => {
        const nextLines = splitPlainTextDocument(value);
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
    [lineClasses, publishCaretPosition],
  );

  return (
    <div className={editorScrollClass}>
      <div
        ref={rootRef}
        className={editorSurfaceClass}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="纯文本编辑器"
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
          linesRef.current = next;
          onChange?.(joinPlainTextDocument(next));
          publishCaretPosition();
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
          linesRef.current = next;
          onChange?.(joinPlainTextDocument(next));
          publishCaretPosition();
        }}
      />
    </div>
  );
}
