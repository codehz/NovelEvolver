export type EditorCaretPosition = {
  line: number;
  column: number;
};

export function formatEditorCaretPosition(position: EditorCaretPosition): string {
  return `Ln ${position.line}, Col ${position.column}`;
}
