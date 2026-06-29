const PHYSICAL_LINE_SELECTOR = "[data-physical-line]";
const PHYSICAL_LINE_CONTENT_SELECTOR = "[data-physical-line-content]";

export type PlainTextEditorLineClasses = {
  lineRowClass: string;
  lineContentClass: string;
};

function isStructuredLineRow(element: HTMLElement): boolean {
  return element.querySelector(PHYSICAL_LINE_CONTENT_SELECTOR) !== null;
}

function getLineContentElement(row: HTMLElement): HTMLElement {
  return row.querySelector<HTMLElement>(PHYSICAL_LINE_CONTENT_SELECTOR) ?? row;
}

function readLineTextFromRow(row: HTMLElement): string {
  const content = getLineContentElement(row);
  return content.textContent ?? "";
}

function fillLineContentElement(content: HTMLElement, line: string): void {
  if (line.length === 0) {
    content.replaceChildren(document.createElement("br"));
    return;
  }
  content.textContent = line;
}

function createPhysicalLineRow(line: string, classes: PlainTextEditorLineClasses): HTMLDivElement {
  const row = document.createElement("div");
  row.dataset.physicalLine = "true";
  row.className = classes.lineRowClass;

  const content = document.createElement("div");
  content.dataset.physicalLineContent = "true";
  content.className = classes.lineContentClass;
  fillLineContentElement(content, line);

  row.append(content);
  return row;
}

export function splitPlainTextDocument(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  if (normalized.length === 0) {
    return [""];
  }
  return normalized.split("\n");
}

export function joinPlainTextDocument(lines: string[]): string {
  return lines.join("\n");
}

function getPhysicalLineBlocks(root: HTMLElement): HTMLElement[] {
  const marked = root.querySelectorAll<HTMLElement>(PHYSICAL_LINE_SELECTOR);
  if (marked.length > 0) {
    return Array.from(marked);
  }

  const direct = Array.from(root.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  if (direct.length > 0) {
    return direct;
  }

  return [];
}

export function readPhysicalLinesFromEditor(root: HTMLElement): string[] {
  const blocks = getPhysicalLineBlocks(root);
  if (blocks.length === 0) {
    return splitPlainTextDocument(root.textContent ?? "");
  }

  return blocks.map((block) => readLineTextFromRow(block));
}

export function normalizeEditorDom(root: HTMLElement, classes: PlainTextEditorLineClasses): void {
  const blocks = getPhysicalLineBlocks(root);

  if (blocks.length === 0) {
    writePhysicalLinesToEditor(root, [""], classes);
    return;
  }

  const lines = blocks.map((block) => readLineTextFromRow(block));
  const needsStructure = blocks.some((block) => !isStructuredLineRow(block));

  if (needsStructure) {
    writePhysicalLinesToEditor(root, lines, classes);
    return;
  }

  blocks.forEach((block) => {
    block.dataset.physicalLine = "true";
    block.className = classes.lineRowClass;

    const content = getLineContentElement(block);
    content.className = classes.lineContentClass;
    if ((content.textContent ?? "").length === 0 && content.childElementCount === 0) {
      fillLineContentElement(content, "");
    }
  });
}

export function writePhysicalLinesToEditor(
  root: HTMLElement,
  lines: string[],
  classes: PlainTextEditorLineClasses,
): void {
  root.replaceChildren(...lines.map((line) => createPhysicalLineRow(line, classes)));
}

export function applyPhysicalEnter(
  root: HTMLElement,
  classes: PlainTextEditorLineClasses,
): string[] {
  normalizeEditorDom(root, classes);
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return readPhysicalLinesFromEditor(root);
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) {
    return readPhysicalLinesFromEditor(root);
  }

  const lines = readPhysicalLinesFromEditor(root);
  const { lineIndex, offset } = getLogicalCaret(lines, root, range);
  const current = lines[lineIndex] ?? "";
  const before = current.slice(0, offset);
  const after = current.slice(offset);

  const next = [...lines];
  next[lineIndex] = before;
  next.splice(lineIndex + 1, 0, after);

  writePhysicalLinesToEditor(root, next, classes);
  setLogicalCaret(root, lineIndex + 1, 0);
  return next;
}

export function applyPlainTextPaste(
  root: HTMLElement,
  pasted: string,
  classes: PlainTextEditorLineClasses,
): void {
  normalizeEditorDom(root, classes);
  const normalized = pasted.replace(/\r\n/g, "\n");
  const inserted = splitPlainTextDocument(normalized);
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    writePhysicalLinesToEditor(root, inserted, classes);
    return;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) {
    writePhysicalLinesToEditor(root, inserted, classes);
    return;
  }

  const lines = readPhysicalLinesFromEditor(root);
  const { lineIndex, offset } = getLogicalCaret(lines, root, range);
  const current = lines[lineIndex] ?? "";
  const before = current.slice(0, offset);
  const after = current.slice(offset);

  const next = [...lines];
  if (inserted.length === 1) {
    next[lineIndex] = before + inserted[0] + after;
  } else {
    const tail = (inserted.at(-1) ?? "") + after;
    next[lineIndex] = before + (inserted[0] ?? "");
    next.splice(lineIndex + 1, 0, ...inserted.slice(1, -1), tail);
  }

  writePhysicalLinesToEditor(root, next, classes);
  const focusLine = lineIndex + inserted.length - 1;
  const focusOffset =
    inserted.length === 1 ? before.length + inserted[0].length : (inserted.at(-1)?.length ?? 0);
  setLogicalCaret(root, focusLine, focusOffset);
}

function getLogicalCaret(
  lines: string[],
  root: HTMLElement,
  range: Range,
): { lineIndex: number; offset: number } {
  const blocks = getPhysicalLineBlocks(root);
  if (blocks.length === 0) {
    const text = root.textContent ?? "";
    return { lineIndex: 0, offset: text.length };
  }

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    const content = getLineContentElement(block);
    if (!content.contains(range.startContainer) && content !== range.startContainer) {
      continue;
    }

    const prefix = range.cloneRange();
    prefix.selectNodeContents(content);
    prefix.setEnd(range.startContainer, range.startOffset);
    return { lineIndex: index, offset: prefix.toString().length };
  }

  return { lineIndex: Math.max(0, lines.length - 1), offset: lines.at(-1)?.length ?? 0 };
}

export function readCaretPositionFromEditor(root: HTMLElement): {
  line: number;
  column: number;
} | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) {
    return null;
  }

  const lines = readPhysicalLinesFromEditor(root);
  const { lineIndex, offset } = getLogicalCaret(lines, root, range);
  return { line: lineIndex + 1, column: offset + 1 };
}

function setLogicalCaret(root: HTMLElement, lineIndex: number, offset: number): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const block = getPhysicalLineBlocks(root)[lineIndex];
  if (!block) {
    return;
  }

  const content = getLineContentElement(block);
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let textNode = walker.nextNode() as Text | null;

  while (textNode) {
    const length = textNode.data.length;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(textNode, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    textNode = walker.nextNode() as Text | null;
  }

  const range = document.createRange();
  range.selectNodeContents(content);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}
