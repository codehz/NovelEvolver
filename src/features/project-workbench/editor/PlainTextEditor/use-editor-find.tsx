import { AutoTransition, effects, preset } from "@codehz/auto-transition";
import type { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { clearEditorFindQuery, getEditorFindSeedFromSelection } from "./editor-find";
import { createEditorFindKeymap } from "./editor-find-keymap";
import { EditorFindBar } from "./EditorFindBar";

/** Matches workbench overlay ease (`overlayMotionClass`). */
const editorFindBarEase = "cubic-bezier(0.33, 1, 0.68, 1)";

const editorFindBarTransition = preset({
  enter: [effects.fade(0), effects.translate({ x: 0, y: -6 }), effects.scale(0.98)],
  exit: [effects.fade(0), effects.translate({ x: 0, y: -4 }), effects.scale(0.98)],
  timing: {
    enter: { duration: 220, easing: editorFindBarEase },
    exit: { duration: 160, easing: editorFindBarEase },
  },
});

export type UseEditorFindOptions = {
  viewRef: RefObject<EditorView | null>;
  /** When false, replace UI and replace shortcuts stay find-only. */
  allowReplace?: boolean;
};

export type EditorFindController = {
  /** True while the find bar is open (for CM updateListener / Escape). */
  isOpen: () => boolean;
  openFind: (withReplace: boolean) => void;
  closeFind: () => void;
  /** Refresh match stats after next/previous from the keymap. */
  refreshStats: () => void;
  /** Keymap for the custom find bar; handlers close over live refs. */
  keymap: ReturnType<typeof createEditorFindKeymap>;
  /** Animated find overlay node to render inside a `relative` editor host. */
  overlay: ReactNode;
};

export function useEditorFind({
  viewRef,
  allowReplace = true,
}: UseEditorFindOptions): EditorFindController {
  const [findOpen, setFindOpen] = useState(false);
  const [findReplaceExpanded, setFindReplaceExpanded] = useState(false);
  const [findSeed, setFindSeed] = useState("");
  const [findSession, setFindSession] = useState(0);
  const [findView, setFindView] = useState<EditorView | null>(null);

  const findOpenRef = useRef(false);
  const findStatsRefreshRef = useRef<(() => void) | null>(null);
  const allowReplaceRef = useRef(allowReplace);
  allowReplaceRef.current = allowReplace;
  findOpenRef.current = findOpen;

  const openFindRef = useRef((withReplace: boolean) => {
    void withReplace;
  });
  const closeFindRef = useRef(() => {});

  openFindRef.current = (withReplace: boolean) => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const canReplace = allowReplaceRef.current;
    setFindSeed(getEditorFindSeedFromSelection(view.state));
    setFindReplaceExpanded(canReplace && withReplace);
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

  useEffect(() => {
    if (!allowReplace) {
      setFindReplaceExpanded(false);
    }
  }, [allowReplace]);

  // Keymap is created once per mount of this hook and uses refs for live handlers.
  // Replace permission is enforced in openFind (allowReplaceRef), not baked into bindings.
  const keymapRef = useRef(
    createEditorFindKeymap({
      openFind: (withReplace) => openFindRef.current(withReplace),
      closeFind: () => closeFindRef.current(),
      isOpen: () => findOpenRef.current,
      onFindStep: () => findStatsRefreshRef.current?.(),
      // Always advertise replace shortcuts; openFind clamps when disallowed.
      allowReplace: true,
    }),
  );

  const overlay = (
    <AutoTransition
      as="div"
      className="contents"
      transition={editorFindBarTransition}
      exitLayout="absolute"
    >
      {findOpen && findView ? (
        <EditorFindBar
          key={findSession}
          view={findView}
          replaceExpanded={findReplaceExpanded}
          initialQuery={findSeed}
          allowReplace={allowReplace}
          onReplaceExpandedChange={setFindReplaceExpanded}
          onClose={() => {
            closeFindRef.current();
          }}
          onBindRefresh={(refresh) => {
            findStatsRefreshRef.current = refresh;
          }}
        />
      ) : null}
    </AutoTransition>
  );

  return {
    isOpen: () => findOpenRef.current,
    openFind: (withReplace) => openFindRef.current(withReplace),
    closeFind: () => closeFindRef.current(),
    refreshStats: () => findStatsRefreshRef.current?.(),
    keymap: keymapRef.current,
    overlay,
  };
}
