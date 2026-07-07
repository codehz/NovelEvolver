import { getOriginalDoc, originalDocChangeEffect, unifiedMergeView } from "@codemirror/merge";
import { ChangeSet, Compartment, EditorState, type Extension } from "@codemirror/state";
import { drawSelection, EditorView } from "@codemirror/view";
import { useEffect, useLayoutEffect, useRef } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { editorHostClass } from "#workbench/editor/PlainTextEditor/codemirror-theme";
import { plainTextEditorViewExtensions } from "#workbench/editor/PlainTextEditor/codemirror-view-extensions";

const textComparisonRootClass = cn("min-h-0 min-w-0 flex-1");

const textComparisonTheme = EditorView.theme(
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

export type TextComparisonRestoreHunkChange = {
  beforeContent: string;
  afterContent: string;
};

function editableStateExtensions(editable: boolean): Extension[] {
  return [EditorState.readOnly.of(!editable), EditorView.editable.of(editable)];
}

function contentAttributesExtension(ariaLabel: string): Extension {
  return EditorView.contentAttributes.of({
    "aria-label": ariaLabel,
    "aria-multiline": "true",
    role: "textbox",
  });
}

type TextComparisonEditorProps = {
  active: boolean;
  originalContent: string;
  currentContent: string;
  editable?: boolean;
  onChange?: (next: string) => void;
  onRestoreHunk?: (change: TextComparisonRestoreHunkChange) => Promise<void> | void;
  "aria-label"?: string;
};

export function TextComparisonEditor({
  active,
  originalContent,
  currentContent,
  editable = false,
  onChange,
  onRestoreHunk,
  "aria-label": ariaLabel = "文本差异预览",
}: TextComparisonEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const editableCompartmentRef = useRef(new Compartment());
  const contentAttributesCompartmentRef = useRef(new Compartment());
  const initialAriaLabelRef = useRef(ariaLabel);
  const initialCurrentContentRef = useRef(currentContent);
  const initialEditableRef = useRef(editable);
  const initialOriginalContentRef = useRef(originalContent);
  const onChangeRef = useRef(onChange);
  const onRestoreHunkRef = useRef(onRestoreHunk);
  const restoreInFlightRef = useRef(false);
  const suppressOnChangeRef = useRef(false);

  onChangeRef.current = onChange;
  onRestoreHunkRef.current = onRestoreHunk;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const extensions: Extension[] = [
      ...plainTextEditorViewExtensions,
      drawSelection(),
      textComparisonTheme,
      editableCompartmentRef.current.of(editableStateExtensions(initialEditableRef.current)),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
          return;
        }

        if (update.transactions.some((transaction) => transaction.isUserEvent("revert"))) {
          const beforeContent = update.startState.doc.toString();
          const afterContent = update.state.doc.toString();
          const restoreHunk = onRestoreHunkRef.current;
          if (beforeContent === afterContent || restoreHunk === undefined) {
            return;
          }

          restoreInFlightRef.current = true;
          void Promise.resolve(restoreHunk({ beforeContent, afterContent }))
            .catch(() => {
              suppressOnChangeRef.current = true;
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
          return;
        }

        const shouldNotify = !suppressOnChangeRef.current;
        suppressOnChangeRef.current = false;
        if (shouldNotify) {
          onChangeRef.current?.(update.state.doc.toString());
        }
      }),
      contentAttributesCompartmentRef.current.of(
        contentAttributesExtension(initialAriaLabelRef.current),
      ),
      unifiedMergeView({
        original: initialOriginalContentRef.current,
        mergeControls: (type: "accept" | "reject", action: (event: MouseEvent) => void) => {
          if (type === "accept" || onRestoreHunkRef.current === undefined) {
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
        doc: initialCurrentContentRef.current,
        extensions,
      }),
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: editableCompartmentRef.current.reconfigure(editableStateExtensions(editable)),
    });
  }, [editable]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.dispatch({
      effects: contentAttributesCompartmentRef.current.reconfigure(
        contentAttributesExtension(ariaLabel),
      ),
    });
  }, [ariaLabel]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === currentContent) {
      return;
    }

    suppressOnChangeRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: currentContent,
      },
    });
  }, [currentContent]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentOriginal = getOriginalDoc(view.state);
    if (currentOriginal.toString() === originalContent) {
      return;
    }

    view.dispatch({
      effects: originalDocChangeEffect(
        view.state,
        ChangeSet.of(
          [
            {
              from: 0,
              to: currentOriginal.length,
              insert: originalContent,
            },
          ],
          currentOriginal.length,
        ),
      ),
    });
  }, [originalContent]);

  useLayoutEffect(() => {
    if (active) {
      viewRef.current?.focus();
    }
  }, [active]);

  return (
    <div className={textComparisonRootClass}>
      <div ref={hostRef} className={editorHostClass} />
    </div>
  );
}
