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

function readPhysicalLinesFromBlocks(blocks: HTMLElement[]): string[] {
  return blocks.map((block) => readLineTextFromRow(block));
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

  return readPhysicalLinesFromBlocks(blocks);
}

export function normalizeEditorDom(root: HTMLElement, classes: PlainTextEditorLineClasses): void {
  const blocks = getPhysicalLineBlocks(root);

  if (blocks.length === 0) {
    writePhysicalLinesToEditor(root, [""], classes);
    return;
  }

  const lines = readPhysicalLinesFromBlocks(blocks);
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
  const blocks = getPhysicalLineBlocks(root);
  if (blocks.length === 0) {
    root.replaceChildren(...lines.map((line) => createPhysicalLineRow(line, classes)));
    return;
  }

  const currentLines = readPhysicalLinesFromBlocks(blocks);
  let prefix = 0;
  while (
    prefix < currentLines.length &&
    prefix < lines.length &&
    currentLines[prefix] === lines[prefix]
  ) {
    prefix += 1;
  }

  let currentSuffix = currentLines.length - 1;
  let nextSuffix = lines.length - 1;
  while (
    currentSuffix >= prefix &&
    nextSuffix >= prefix &&
    currentLines[currentSuffix] === lines[nextSuffix]
  ) {
    currentSuffix -= 1;
    nextSuffix -= 1;
  }

  if (prefix > currentSuffix && prefix > nextSuffix) {
    return;
  }

  const fragment = document.createDocumentFragment();
  for (let index = prefix; index <= nextSuffix; index += 1) {
    fragment.append(createPhysicalLineRow(lines[index] ?? "", classes));
  }

  const anchor = blocks[currentSuffix + 1] ?? null;
  for (let index = prefix; index <= currentSuffix; index += 1) {
    blocks[index]?.remove();
  }
  root.insertBefore(fragment, anchor);
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
  const { lineIndex, offset } = getLogicalCaret(root, range);
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
  const { lineIndex, offset } = getLogicalCaret(root, range);
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

function getLineIndexFromBlock(root: HTMLElement, block: HTMLElement): number {
  let index = 0;
  let cursor = block.previousElementSibling;
  while (cursor) {
    if (cursor instanceof HTMLElement) {
      index += 1;
    }
    cursor = cursor.previousElementSibling;
  }
  return index;
}

function getLineBlockFromNode(root: HTMLElement, node: Node): HTMLElement | null {
  if (node instanceof HTMLElement) {
    const block = node.closest<HTMLElement>(PHYSICAL_LINE_SELECTOR);
    if (block?.parentElement === root) {
      return block;
    }
  }

  const parent = node.parentElement;
  if (!parent) {
    return null;
  }

  const block = parent.closest<HTMLElement>(PHYSICAL_LINE_SELECTOR);
  return block?.parentElement === root ? block : null;
}

function getLogicalCaret(root: HTMLElement, range: Range): { lineIndex: number; offset: number } {
  const blocks = getPhysicalLineBlocks(root);
  if (blocks.length === 0) {
    const text = root.textContent ?? "";
    return { lineIndex: 0, offset: text.length };
  }

  const lineBlock = getLineBlockFromNode(root, range.startContainer);
  if (lineBlock) {
    const content = getLineContentElement(lineBlock);
    const prefix = range.cloneRange();
    prefix.selectNodeContents(content);
    prefix.setEnd(range.startContainer, range.startOffset);
    return { lineIndex: getLineIndexFromBlock(root, lineBlock), offset: prefix.toString().length };
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

  const lastLine = readLineTextFromRow(blocks.at(-1) ?? root);
  return { lineIndex: Math.max(0, blocks.length - 1), offset: lastLine.length };
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

  const { lineIndex, offset } = getLogicalCaret(root, range);
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
