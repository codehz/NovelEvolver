import { StatusBarItemInfo } from "#workbench/chrome";

import { formatEditorCaretPosition } from "../editor/state/editor-caret";
import { useActiveTabCaretPosition } from "../editor/use-active-tab-caret";

export function CaretPositionIndicator() {
  const caret = useActiveTabCaretPosition();
  if (caret === null) {
    return null;
  }

  return <StatusBarItemInfo numeric>{formatEditorCaretPosition(caret)}</StatusBarItemInfo>;
}
