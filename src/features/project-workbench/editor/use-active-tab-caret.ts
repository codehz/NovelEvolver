import { useMolecule } from "bunshi/react";
import { atom, useAtomValue } from "jotai";
import { useMemo } from "react";

import type { EditorCaretPosition } from "./state/editor-caret";
import { editorTabMolecule, editorTabScope, workbenchEditorMolecule } from "./state/molecules";

const fallbackCaret: EditorCaretPosition = { line: 1, column: 1, selectionLength: 0 };

/** 与 `editorTabScope` 默认 value 一致；无活动标签时仅用于稳定 `useMolecule` 依赖项数量。 */
const noActiveTabScopeValue = "";

export function useActiveTabCaretPosition(): EditorCaretPosition {
  const { activeTabIdAtom } = useMolecule(workbenchEditorMolecule);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const fallbackAtom = useMemo(() => atom(fallbackCaret), []);
  const tabState = useMolecule(editorTabMolecule, {
    withScope: [editorTabScope, activeTabId ?? noActiveTabScopeValue],
  });
  const caretAtom = activeTabId ? tabState.caretPositionAtom : fallbackAtom;

  return useAtomValue(caretAtom);
}
