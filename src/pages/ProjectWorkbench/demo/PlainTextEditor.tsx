import { useCallback, useEffect, useRef, type ClipboardEvent } from "react";
import { cn } from "@/lib/cn";
import { setEditorCaretPosition } from "./editor-caret";
import {
  applyPlainTextPaste,
  normalizeEditorDom,
  PLAIN_TEXT_EDITOR_LINE_CLASS,
  readCaretPositionFromEditor,
  readPhysicalLinesFromEditor,
  writePhysicalLinesToEditor,
} from "./plain-text-editor";

const editorSurfaceClass = cn(
  "plain-text-editor-surface min-h-0 flex-1 overflow-auto p-4 pl-12 font-mono text-sm text-app-foreground outline-none",
);

const physicalLineBlockClass = cn(
  PLAIN_TEXT_EDITOR_LINE_CLASS,
  "min-h-6 leading-6 wrap-break-word whitespace-pre-wrap",
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

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const syncDomFromLines = useCallback((nextLines: string[]) => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    writePhysicalLinesToEditor(root, nextLines, physicalLineBlockClass);
  }, []);

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
    normalizeEditorDom(root, physicalLineBlockClass);
    const next = readPhysicalLinesFromEditor(root);
    linesRef.current = next;
    onLinesChange(next);
    publishCaretPosition();
  }, [onLinesChange, publishCaretPosition]);

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
    <div
      ref={rootRef}
      className={editorSurfaceClass}
      contentEditable
      role="textbox"
      aria-multiline="true"
      aria-label="纯文本编辑器"
      suppressContentEditableWarning
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
        applyPlainTextPaste(root, pasted, physicalLineBlockClass);
        const next = readPhysicalLinesFromEditor(root);
        linesRef.current = next;
        onLinesChange(next);
        publishCaretPosition();
      }}
    />
  );
}
