export type PlainTextEditorCaretPosition = {
  line: number;
  column: number;
  selectionLength: number;
};

export type PlainTextEditorLogicalPosition = {
  lineIndex: number;
  offset: number;
};

export type PlainTextEditorSelectionSnapshot = {
  anchor: PlainTextEditorLogicalPosition;
  focus: PlainTextEditorLogicalPosition;
};
