import { StatusBarItemInfo } from "#app/components/workbench";

import { useActiveTabCaretPosition } from "../editor/use-active-tab-caret";
import { formatEditorCaretPosition } from "../state/editor-caret";

export function CaretPositionIndicator() {
  const caret = useActiveTabCaretPosition();

  return <StatusBarItemInfo numeric>{formatEditorCaretPosition(caret)}</StatusBarItemInfo>;
}
