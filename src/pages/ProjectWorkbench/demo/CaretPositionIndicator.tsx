import { StatusBarItemInfo } from "@/components/workbench";

import { formatEditorCaretPosition } from "./editor-caret";
import { useActiveTabCaretPosition } from "./use-active-tab-caret";

export function CaretPositionIndicator() {
  const caret = useActiveTabCaretPosition();

  return <StatusBarItemInfo numeric>{formatEditorCaretPosition(caret)}</StatusBarItemInfo>;
}
