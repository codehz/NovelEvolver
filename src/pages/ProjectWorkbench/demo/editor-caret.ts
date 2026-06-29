export type EditorCaretPosition = {
  line: number;
  column: number;
  selectionLength: number;
};

export type EditorLogicalPosition = {
  lineIndex: number;
  offset: number;
};

export type EditorSelectionSnapshot = {
  anchor: EditorLogicalPosition;
  focus: EditorLogicalPosition;
};

export function formatEditorCaretPosition(position: EditorCaretPosition): string {
  if (position.selectionLength === 0) {
    return `Ln ${position.line}, Col ${position.column}`;
  }
  return `Ln ${position.line}, Col ${position.column} (${position.selectionLength} selected)`;
}
