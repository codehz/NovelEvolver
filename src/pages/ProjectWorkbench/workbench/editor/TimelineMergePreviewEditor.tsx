import { unifiedMergeView } from "@codemirror/merge";
import { EditorState, type Extension } from "@codemirror/state";
import { drawSelection, EditorView } from "@codemirror/view";
import { useEffect, useLayoutEffect, useRef } from "react";

import { editorHostClass } from "#app/components/PlainTextEditor/codemirror-theme";
import { plainTextEditorViewExtensions } from "#app/components/PlainTextEditor/codemirror-view-extensions";
import { cn } from "#app/lib/cn";

const timelineMergePreviewRootClass = cn("min-h-0 min-w-0 flex-1");

const timelineMergePreviewTheme = EditorView.theme(
  {
    ".cm-deletedChunk": {
      backgroundColor: "color-mix(in srgb, var(--color-ctp-red) 12%, transparent)",
      color: "var(--color-ctp-subtext1)",
    },
    ".cm-deletedLine": {
      textDecoration: "none",
    },
    ".cm-deletedText, .cm-deletedLine del": {
      backgroundColor: "color-mix(in srgb, var(--color-ctp-red) 18%, transparent)",
      textDecoration: "none",
    },
    "&.cm-merge-b .cm-changedLine, .cm-inlineChangedLine": {
      backgroundColor: "color-mix(in srgb, var(--color-ctp-green) 10%, transparent)",
    },
    "&.cm-merge-b .cm-changedText": {
      backgroundColor: "color-mix(in srgb, var(--color-ctp-green) 18%, transparent)",
    },
    ".cm-deletedLineGutter": {
      backgroundColor: "var(--color-ctp-red)",
    },
    "&.cm-merge-b .cm-changedLineGutter": {
      backgroundColor: "var(--color-ctp-green)",
    },
    ".cm-chunkButtons": {
      display: "none",
    },
  },
  { dark: true },
);

type TimelineMergePreviewEditorProps = {
  active: boolean;
  originalContent: string;
  currentContent: string;
  "aria-label"?: string;
};

export function TimelineMergePreviewEditor({
  active,
  originalContent,
  currentContent,
  "aria-label": ariaLabel = "时间线差异预览",
}: TimelineMergePreviewEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const extensions: Extension[] = [
      ...plainTextEditorViewExtensions,
      drawSelection(),
      timelineMergePreviewTheme,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        role: "textbox",
      }),
      unifiedMergeView({
        original: originalContent,
        mergeControls: false,
        allowInlineDiffs: true,
        collapseUnchanged: {
          margin: 3,
          minSize: 8,
        },
      }),
    ];

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: currentContent,
        extensions,
      }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ariaLabel, currentContent, originalContent]);

  useLayoutEffect(() => {
    if (active) {
      viewRef.current?.focus();
    }
  }, [active]);

  return (
    <div className={timelineMergePreviewRootClass}>
      <div ref={hostRef} className={editorHostClass} />
    </div>
  );
}
