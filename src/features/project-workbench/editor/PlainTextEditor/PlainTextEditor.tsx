import { PresenceHost } from "@codehz/auto-transition";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  findNext,
  findPrevious,
  getSearchQuery,
  search,
  selectNextOccurrence,
} from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
} from "@codemirror/view";
import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import {
  caretPositionFromState,
  editorSelectionFromSnapshot,
  isPlainTextEditorSelectionCollapsed,
  selectionSnapshotFromState,
} from "./codemirror-selection";
import { editorHostClass } from "./codemirror-theme";
import { plainTextEditorViewExtensions } from "./codemirror-view-extensions";
import { clearEditorFindQuery, getEditorFindSeedFromSelection } from "./editor-find";
import { editorFindHighlight } from "./editor-find-highlight";
import { EditorFindBar } from "./EditorFindBar";
import type { PlainTextEditorCaretPosition, PlainTextEditorSelectionSnapshot } from "./types";

const editorRootClass = cn("relative min-h-0 min-w-0 flex-1");

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
  const viewRef = useRef<EditorView | null>(null);
  const selectionSnapshotRef = useRef(selectionSnapshot);
  const wasActiveRef = useRef(active);
  const onChangeRef = useRef(onChange);
  const onCaretChangeRef = useRef(onCaretChange);
  const onSelectionSnapshotChangeRef = useRef(onSelectionSnapshotChange);
  const highlightCurrentLineRef = useRef(highlightCurrentLine);
  const ariaLabelRef = useRef(ariaLabel);
  const suppressOnChangeRef = useRef(false);
  const activeLineCollapsedRef = useRef<boolean | null>(null);
  const activeLineCompartmentRef = useRef(new Compartment());
  const [findOpen, setFindOpen] = useState(false);
  const [findReplaceExpanded, setFindReplaceExpanded] = useState(false);
  const [findSeed, setFindSeed] = useState("");
  const [findSession, setFindSession] = useState(0);
  const [findView, setFindView] = useState<EditorView | null>(null);
  const findOpenRef = useRef(false);
  const findStatsRefreshRef = useRef<(() => void) | null>(null);
  const openFindRef = useRef((withReplace: boolean) => {
    void withReplace;
  });
  const closeFindRef = useRef(() => {});

  selectionSnapshotRef.current = selectionSnapshot;
  onChangeRef.current = onChange;
  onCaretChangeRef.current = onCaretChange;
  onSelectionSnapshotChangeRef.current = onSelectionSnapshotChange;
  highlightCurrentLineRef.current = highlightCurrentLine;
  ariaLabelRef.current = ariaLabel;
  findOpenRef.current = findOpen;

  openFindRef.current = (withReplace: boolean) => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    setFindSeed(getEditorFindSeedFromSelection(view.state));
    setFindReplaceExpanded(withReplace);
    setFindView(view);
    setFindSession((session) => session + 1);
    setFindOpen(true);
  };

  closeFindRef.current = () => {
    const view = viewRef.current;
    if (view) {
      clearEditorFindQuery(view);
    }
    setFindOpen(false);
    setFindReplaceExpanded(false);
  };

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
  const publishSelectionStateRef = useRef(publishSelectionState);
  publishSelectionStateRef.current = publishSelectionState;

  // React 19 callback ref: EditorView 生命周期绑定到 host DOM 的 attach/detach。
  // - 稳定 identity，避免 props 变更导致 teardown/recreate 丢文档
  // - 返回 cleanup 后，卸载时 React 跑 cleanup，而不是再以 null 调用 ref
  const setHostNode = useCallback((host: HTMLDivElement) => {
    const activeLineCompartment = activeLineCompartmentRef.current;
    const runFindStep = (view: EditorView, direction: "next" | "previous"): boolean => {
      const query = getSearchQuery(view.state);
      if (!query.valid || query.search === "") {
        openFindRef.current(false);
        return true;
      }
      const ran = direction === "next" ? findNext(view) : findPrevious(view);
      if (ran && findOpenRef.current) {
        findStatsRefreshRef.current?.();
      }
      return ran;
    };
    const extensions: Extension[] = [
      ...plainTextEditorViewExtensions,
      history(),
      drawSelection(),
      search({ top: true }),
      editorFindHighlight,
      keymap.of([
        {
          key: "Mod-f",
          preventDefault: true,
          run: () => {
            openFindRef.current(false);
            return true;
          },
        },
        {
          key: "Mod-h",
          preventDefault: true,
          run: () => {
            openFindRef.current(true);
            return true;
          },
        },
        {
          key: "Mod-Alt-f",
          preventDefault: true,
          run: () => {
            openFindRef.current(true);
            return true;
          },
        },
        {
          key: "Escape",
          run: (view) => {
            if (!findOpenRef.current) {
              return false;
            }
            closeFindRef.current();
            view.focus();
            return true;
          },
        },
        {
          key: "Mod-g",
          preventDefault: true,
          run: (view) => runFindStep(view, "next"),
          shift: (view) => runFindStep(view, "previous"),
        },
        {
          key: "F3",
          preventDefault: true,
          run: (view) => runFindStep(view, "next"),
          shift: (view) => runFindStep(view, "previous"),
        },
        { key: "Mod-d", run: selectNextOccurrence, preventDefault: true },
        ...defaultKeymap,
        ...historyKeymap,
      ]),
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
          publishSelectionStateRef.current(update.view);
        }
        if (findOpenRef.current && (update.docChanged || update.selectionSet)) {
          findStatsRefreshRef.current?.();
        }
      }),
      EditorView.contentAttributes.of({
        "aria-label": ariaLabelRef.current,
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
      if (viewRef.current === view) {
        viewRef.current = null;
      }
      activeLineCollapsedRef.current = null;
    };
  }, []);

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
      <PresenceHost ref={setHostNode} className={editorHostClass} />
      {findOpen && findView ? (
        <EditorFindBar
          key={findSession}
          view={findView}
          replaceExpanded={findReplaceExpanded}
          initialQuery={findSeed}
          onReplaceExpandedChange={setFindReplaceExpanded}
          onClose={() => {
            closeFindRef.current();
          }}
          onBindRefresh={(refresh) => {
            findStatsRefreshRef.current = refresh;
          }}
        />
      ) : null}
    </div>
  );
}
