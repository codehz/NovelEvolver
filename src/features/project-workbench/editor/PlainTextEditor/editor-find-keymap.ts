import { findNext, findPrevious, getSearchQuery, selectNextOccurrence } from "@codemirror/search";
import type { KeyBinding } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

export type EditorFindKeymapHandlers = {
  openFind: (withReplace: boolean) => void;
  closeFind: () => void;
  isOpen: () => boolean;
  /** Called after a successful next/previous step while the bar is open. */
  onFindStep?: () => void;
  allowReplace?: boolean;
};

/**
 * Key bindings for the custom find bar.
 * Keep stable identity (refs) for handlers when used in a one-shot EditorView setup.
 */
export function createEditorFindKeymap({
  openFind,
  closeFind,
  isOpen,
  onFindStep,
  allowReplace = true,
}: EditorFindKeymapHandlers): readonly KeyBinding[] {
  const runFindStep = (view: EditorView, direction: "next" | "previous"): boolean => {
    const query = getSearchQuery(view.state);
    if (!query.valid || query.search === "") {
      openFind(false);
      return true;
    }
    const ran = direction === "next" ? findNext(view) : findPrevious(view);
    if (ran && isOpen()) {
      onFindStep?.();
    }
    return ran;
  };

  return [
    {
      key: "Mod-f",
      preventDefault: true,
      run: () => {
        openFind(false);
        return true;
      },
    },
    {
      key: "Mod-h",
      preventDefault: true,
      run: () => {
        openFind(allowReplace);
        return true;
      },
    },
    {
      key: "Mod-Alt-f",
      preventDefault: true,
      run: () => {
        openFind(allowReplace);
        return true;
      },
    },
    {
      key: "Escape",
      run: (view) => {
        if (!isOpen()) {
          return false;
        }
        closeFind();
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
  ];
}
