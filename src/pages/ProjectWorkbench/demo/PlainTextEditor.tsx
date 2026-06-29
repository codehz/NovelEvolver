import { useCallback, useEffect, useMemo, useRef, type ClipboardEvent } from "react";
import { cn } from "@/lib/cn";
import { setEditorCaretPosition } from "./editor-caret";
import {
  applyPlainTextPaste,
  applyPhysicalEnter,
  normalizeEditorDom,
  readCaretPositionFromEditor,
  readPhysicalLinesFromEditor,
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

export function PlainTextEditor({
  lines,
  onLinesChange,
}: {
  lines: string[];
  onLinesChange: (next: string[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef(lines);
  const mountedRef = useRef(false);

  const lineClasses = useMemo<PlainTextEditorLineClasses>(
    () => ({
      lineRowClass: plainTextEditorLineRowClass,
      lineContentClass,
    }),
    [],
  );

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

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
      syncDomFromLines(lines);
      return;
    }
    const root = rootRef.current;
    if (!root || document.activeElement === root) {
      return;
    }
    syncDomFromLines(lines);
  }, [lines, syncDomFromLines]);

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

  const commitFromDom = useCallback(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    normalizeEditorDom(root, lineClasses);
    const next = readPhysicalLinesFromEditor(root);
    linesRef.current = next;
    onLinesChange(next);
    publishCaretPosition();
  }, [lineClasses, onLinesChange, publishCaretPosition]);

  useEffect(() => {
    const onSelectionChange = () => {
      publishCaretPosition();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [publishCaretPosition]);

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
          onLinesChange(next);
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
          onLinesChange(next);
          publishCaretPosition();
        }}
      />
    </div>
  );
}
