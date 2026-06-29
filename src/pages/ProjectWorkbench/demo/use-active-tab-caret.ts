import { useMolecule } from "bunshi/react";
import { atom, useAtomValue } from "jotai";
import { useMemo } from "react";

import type { EditorCaretPosition } from "./editor-caret";
import {
  editorTabMolecule,
  editorTabScope,
  workbenchEditorMolecule,
} from "./workbench-editor-molecules";

const fallbackCaret: EditorCaretPosition = { line: 1, column: 1 };

export function useActiveTabCaretPosition(): EditorCaretPosition {
  const { activeTabIdAtom } = useMolecule(workbenchEditorMolecule);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const fallbackAtom = useMemo(() => atom(fallbackCaret), []);
  const tabState = useMolecule(
    editorTabMolecule,
    activeTabId ? { withScope: [editorTabScope, activeTabId] } : undefined,
  );
  const caretAtom = activeTabId ? tabState.caretPositionAtom : fallbackAtom;

  return useAtomValue(caretAtom);
}
