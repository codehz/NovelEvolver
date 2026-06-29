import { formatEditorCaretPosition } from "./editor-caret";
import { useActiveTabCaretPosition } from "./use-active-tab-caret";

export function CaretPositionIndicator() {
  const caret = useActiveTabCaretPosition();

  return (
    <span className="flex shrink-0 items-center px-2.5 tabular-nums">
      {formatEditorCaretPosition(caret)}
    </span>
  );
}
