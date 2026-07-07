import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
} from "@codemirror/view";
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import {
  caretPositionFromState,
  editorSelectionFromSnapshot,
  isPlainTextEditorSelectionCollapsed,
  selectionSnapshotFromState,
} from "./codemirror-selection";
import { editorHostClass } from "./codemirror-theme";
import { plainTextEditorViewExtensions } from "./codemirror-view-extensions";
import type { PlainTextEditorCaretPosition, PlainTextEditorSelectionSnapshot } from "./types";

const editorRootClass = cn("min-h-0 min-w-0 flex-1");

export type PlainTextEditorApplySelectionOptions = {
  focus?: boolean;
  scrollIntoView?: boolean;
};

export type PlainTextEditorHandle = {
  focus: () => void;
  restoreSelection: () => void;
  applySelection: (
    snapshot: PlainTextEditorSelectionSnapshot,
    options?: PlainTextEditorApplySelectionOptions,
  ) => boolean;
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

function activeLineExtensions(highlight: boolean, collapsed: boolean): Extension[] {
  if (!highlight || !collapsed) {
    return [];
  }
  return [highlightActiveLine(), highlightActiveLineGutter()];
}

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
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const selectionSnapshotRef = useRef(selectionSnapshot);
  const wasActiveRef = useRef(active);
  const onChangeRef = useRef(onChange);
  const onCaretChangeRef = useRef(onCaretChange);
  const onSelectionSnapshotChangeRef = useRef(onSelectionSnapshotChange);
  const highlightCurrentLineRef = useRef(highlightCurrentLine);
  const suppressOnChangeRef = useRef(false);
  const activeLineCollapsedRef = useRef<boolean | null>(null);
  const activeLineCompartmentRef = useRef(new Compartment());

  selectionSnapshotRef.current = selectionSnapshot;
  onChangeRef.current = onChange;
  onCaretChangeRef.current = onCaretChange;
  onSelectionSnapshotChangeRef.current = onSelectionSnapshotChange;
  highlightCurrentLineRef.current = highlightCurrentLine;

  const syncActiveLineHighlight = useCallback(
    (view: EditorView, snapshot: PlainTextEditorSelectionSnapshot) => {
      if (!highlightCurrentLineRef.current) {
        return;
      }
      const collapsed = isPlainTextEditorSelectionCollapsed(snapshot);
      if (activeLineCollapsedRef.current === collapsed) {
        return;
      }
      activeLineCollapsedRef.current = collapsed;
      view.dispatch({
        effects: activeLineCompartmentRef.current.reconfigure(
          activeLineExtensions(true, collapsed),
        ),
      });
    },
    [],
  );

  const publishSelectionState = useCallback(
    (view: EditorView) => {
      if (!view.hasFocus) {
        if (highlightCurrentLineRef.current && activeLineCollapsedRef.current !== null) {
          activeLineCollapsedRef.current = null;
          view.dispatch({
            effects: activeLineCompartmentRef.current.reconfigure([]),
          });
        }
        return;
      }

      const snapshot = selectionSnapshotFromState(view.state);
      onSelectionSnapshotChangeRef.current?.(snapshot);
      onCaretChangeRef.current?.(caretPositionFromState(view.state));
      syncActiveLineHighlight(view, snapshot);
    },
    [syncActiveLineHighlight],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const activeLineCompartment = activeLineCompartmentRef.current;
    const extensions: Extension[] = [
      ...plainTextEditorViewExtensions,
      history(),
      drawSelection(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      activeLineCompartment.of(activeLineExtensions(highlightCurrentLineRef.current, true)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const shouldNotify = !suppressOnChangeRef.current;
          suppressOnChangeRef.current = false;
          if (shouldNotify) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }
        if (update.docChanged || update.selectionSet || update.focusChanged) {
          publishSelectionState(update.view);
        }
      }),
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        role: "textbox",
      }),
    ];

    let state = EditorState.create({
      doc: initialDefaultRef.current,
      extensions,
    });

    const initialSnapshot = selectionSnapshotRef.current;
    if (initialSnapshot) {
      state = state.update({
        selection: editorSelectionFromSnapshot(state.doc, initialSnapshot),
      }).state;
    }

    const view = new EditorView({ state, parent: host });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
      activeLineCollapsedRef.current = null;
    };
  }, [ariaLabel, publishSelectionState]);

  const applySelection = useCallback(
    (
      snapshot: PlainTextEditorSelectionSnapshot,
      { focus = true, scrollIntoView = false }: PlainTextEditorApplySelectionOptions = {},
    ): boolean => {
      const view = viewRef.current;
      if (!view) {
        return false;
      }

      const selection = editorSelectionFromSnapshot(view.state.doc, snapshot);
      const effects = scrollIntoView
        ? [EditorView.scrollIntoView(selection.main.head, { y: "center" })]
        : [];
      view.dispatch({
        selection,
        effects,
      });
      if (focus) {
        view.focus();
      }
      publishSelectionState(view);
      return true;
    },
    [publishSelectionState],
  );

  const restoreSelection = useCallback(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const snapshot = selectionSnapshotRef.current;
    if (snapshot) {
      if (applySelection(snapshot)) {
        return;
      }
    }
    view.focus();
    publishSelectionState(view);
  }, [applySelection, publishSelectionState]);

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
        viewRef.current?.focus();
      },
      restoreSelection,
      applySelection,
      getValue: () => viewRef.current?.state.doc.toString() ?? "",
      setValue: (nextValue: string) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        const current = view.state.doc.toString();
        if (current === nextValue) {
          return;
        }
        suppressOnChangeRef.current = true;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: nextValue },
        });
        publishSelectionState(view);
      },
      getCaret: () => {
        const view = viewRef.current;
        if (!view) {
          return null;
        }
        return caretPositionFromState(view.state);
      },
    }),
    [applySelection, publishSelectionState, restoreSelection],
  );

  return (
    <div className={editorRootClass}>
      <div ref={hostRef} className={editorHostClass} />
    </div>
  );
}
