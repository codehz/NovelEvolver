import { StatusBarItemInfo } from "#workbench/chrome";

import { formatEditorCaretPosition } from "./state/editor-caret";
import { useActiveTabCaretPosition } from "./use-active-tab-caret";

export function CaretPositionIndicator() {
  const caret = useActiveTabCaretPosition();
  if (caret === null) {
    return null;
  }

  return <StatusBarItemInfo numeric>{formatEditorCaretPosition(caret)}</StatusBarItemInfo>;
}
