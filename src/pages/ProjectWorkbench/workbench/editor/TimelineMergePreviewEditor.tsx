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
      display: "flex",
      justifyContent: "flex-end",
      padding: "0.25rem 0.75rem",
    },
    ".cm-chunkButtons button": {
      alignItems: "center",
      backgroundColor: "color-mix(in srgb, var(--color-ctp-surface1) 86%, transparent)",
      border: "1px solid var(--color-titlebar-border)",
      borderRadius: "0.25rem",
      color: "var(--color-app-foreground)",
      cursor: "default",
      display: "inline-flex",
      fontFamily: "var(--font-sans)",
      fontSize: "0.75rem",
      gap: "0.25rem",
      lineHeight: "1rem",
      padding: "0.125rem 0.5rem",
    },
    ".cm-chunkButtons button:hover": {
      backgroundColor: "color-mix(in srgb, var(--color-ctp-surface2) 86%, transparent)",
    },
  },
  { dark: true },
);

export type TimelineMergePreviewRestoreHunkChange = {
  beforeContent: string;
  afterContent: string;
};

type TimelineMergePreviewEditorProps = {
  active: boolean;
  originalContent: string;
  currentContent: string;
  onRestoreHunk?: (change: TimelineMergePreviewRestoreHunkChange) => Promise<void> | void;
  "aria-label"?: string;
};

export function TimelineMergePreviewEditor({
  active,
  originalContent,
  currentContent,
  onRestoreHunk,
  "aria-label": ariaLabel = "时间线差异预览",
}: TimelineMergePreviewEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onRestoreHunkRef = useRef(onRestoreHunk);
  const restoreInFlightRef = useRef(false);

  onRestoreHunkRef.current = onRestoreHunk;

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
      EditorView.updateListener.of((update) => {
        if (
          !update.docChanged ||
          !update.transactions.some((transaction) => transaction.isUserEvent("revert"))
        ) {
          return;
        }

        const beforeContent = update.startState.doc.toString();
        const afterContent = update.state.doc.toString();
        const restoreHunk = onRestoreHunkRef.current;
        if (beforeContent === afterContent || restoreHunk === undefined) {
          return;
        }

        restoreInFlightRef.current = true;
        void Promise.resolve(restoreHunk({ beforeContent, afterContent }))
          .catch(() => {
            update.view.dispatch({
              changes: {
                from: 0,
                to: update.view.state.doc.length,
                insert: beforeContent,
              },
            });
          })
          .finally(() => {
            restoreInFlightRef.current = false;
          });
      }),
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        role: "textbox",
      }),
      unifiedMergeView({
        original: originalContent,
        mergeControls: (type, action) => {
          if (type === "accept") {
            const hidden = document.createElement("span");
            hidden.style.display = "none";
            return hidden;
          }

          const button = document.createElement("button");
          button.type = "button";
          button.setAttribute("aria-label", "回滚此块");
          button.title = "回滚此块";
          button.onmousedown = (event) => {
            if (restoreInFlightRef.current) {
              event.preventDefault();
              return;
            }
            action(event);
          };

          const icon = button.appendChild(document.createElement("span"));
          icon.className = "icon-[codicon--discard]";
          icon.setAttribute("aria-hidden", "true");
          button.append("回滚此块");
          return button;
        },
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
