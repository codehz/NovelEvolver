export type EditorCaretPosition = {
  line: number;
  column: number;
};

const defaultCaret: EditorCaretPosition = { line: 1, column: 1 };

let caretPosition = defaultCaret;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getEditorCaretPosition(): EditorCaretPosition {
  return caretPosition;
}

export function setEditorCaretPosition(next: EditorCaretPosition) {
  if (caretPosition.line === next.line && caretPosition.column === next.column) {
    return;
  }
  caretPosition = next;
  emit();
}

export function resetEditorCaretPosition() {
  setEditorCaretPosition(defaultCaret);
}

export function subscribeEditorCaretPosition(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function formatEditorCaretPosition(position: EditorCaretPosition): string {
  return `Ln ${position.line}, Col ${position.column}`;
}
