import type { PlainTextEditorLogicalPosition, PlainTextEditorSelectionSnapshot } from "./types";

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

  // 两行片段才能走 replaceSelectionWithLines 的拆行逻辑；单元素 [""] 会合并到当前行。
  const { lines: next, focus } = replaceSelectionWithLines(root, ["", ""], range);
  writePhysicalLinesToEditor(root, next, classes);
  setLogicalCaret(root, focus.lineIndex, focus.offset);
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

  const { lines: next, focus } = replaceSelectionWithLines(root, inserted, range);
  writePhysicalLinesToEditor(root, next, classes);
  setLogicalCaret(root, focus.lineIndex, focus.offset);
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
  selectionLength: number;
} | null {
  const snapshot = readSelectionSnapshotFromEditor(root);
  if (!snapshot) {
    return null;
  }

  return {
    line: snapshot.focus.lineIndex + 1,
    column: snapshot.focus.offset + 1,
    selectionLength: getSelectionLength(root, snapshot),
  };
}

function setLogicalCaret(root: HTMLElement, lineIndex: number, offset: number): void {
  setLogicalSelection(root, {
    anchor: { lineIndex, offset },
    focus: { lineIndex, offset },
  });
}

function createCollapsedRange(root: HTMLElement, lineIndex: number, offset: number): Range | null {
  const block = getPhysicalLineBlocks(root)[lineIndex];
  if (!block) {
    return null;
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
      return range;
    }
    remaining -= length;
    textNode = walker.nextNode() as Text | null;
  }

  const range = document.createRange();
  range.selectNodeContents(content);
  range.collapse(false);
  return range;
}

export function readSelectionSnapshotFromEditor(
  root: HTMLElement,
): PlainTextEditorSelectionSnapshot | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }

  const anchorRange = document.createRange();
  anchorRange.setStart(selection.anchorNode ?? range.startContainer, selection.anchorOffset);
  anchorRange.collapse(true);

  const focusRange = document.createRange();
  focusRange.setStart(selection.focusNode ?? range.endContainer, selection.focusOffset);
  focusRange.collapse(true);

  return {
    anchor: getLogicalCaret(root, anchorRange),
    focus: getLogicalCaret(root, focusRange),
  };
}

export function setLogicalSelection(
  root: HTMLElement,
  snapshot: PlainTextEditorSelectionSnapshot,
): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const anchorRange = createCollapsedRange(root, snapshot.anchor.lineIndex, snapshot.anchor.offset);
  const focusRange = createCollapsedRange(root, snapshot.focus.lineIndex, snapshot.focus.offset);
  if (!anchorRange || !focusRange) {
    return;
  }

  const range = anchorRange.cloneRange();
  range.setEnd(focusRange.endContainer, focusRange.endOffset);
  selection.removeAllRanges();
  selection.addRange(range);

  if (selection.extend) {
    selection.collapse(anchorRange.startContainer, anchorRange.startOffset);
    selection.extend(focusRange.endContainer, focusRange.endOffset);
  }
}

function compareLogicalPositions(
  a: PlainTextEditorLogicalPosition,
  b: PlainTextEditorLogicalPosition,
): number {
  if (a.lineIndex !== b.lineIndex) {
    return a.lineIndex - b.lineIndex;
  }
  return a.offset - b.offset;
}

function orderSelectionSnapshot(snapshot: PlainTextEditorSelectionSnapshot): {
  start: PlainTextEditorLogicalPosition;
  end: PlainTextEditorLogicalPosition;
} {
  return compareLogicalPositions(snapshot.anchor, snapshot.focus) <= 0
    ? { start: snapshot.anchor, end: snapshot.focus }
    : { start: snapshot.focus, end: snapshot.anchor };
}

function getSelectionLength(root: HTMLElement, snapshot: PlainTextEditorSelectionSnapshot): number {
  const { start, end } = orderSelectionSnapshot(snapshot);
  if (compareLogicalPositions(start, end) === 0) {
    return 0;
  }

  const lines = readPhysicalLinesFromEditor(root);
  if (start.lineIndex === end.lineIndex) {
    return Math.max(0, end.offset - start.offset);
  }

  let length = Math.max(0, (lines[start.lineIndex] ?? "").length - start.offset);
  for (let index = start.lineIndex + 1; index < end.lineIndex; index += 1) {
    length += (lines[index] ?? "").length;
  }
  length += end.offset;
  length += end.lineIndex - start.lineIndex;
  return length;
}

function replaceSelectionWithLines(
  root: HTMLElement,
  inserted: string[],
  range: Range,
): { lines: string[]; focus: PlainTextEditorLogicalPosition } {
  const lines = readPhysicalLinesFromEditor(root);
  const start = getLogicalCaret(root, range);
  const endRange = range.cloneRange();
  endRange.collapse(false);
  const end = getLogicalCaret(root, endRange);
  const ordered =
    compareLogicalPositions(start, end) <= 0 ? { start, end } : { start: end, end: start };

  const beforeLines = lines.slice(0, ordered.start.lineIndex);
  const afterLines = lines.slice(ordered.end.lineIndex + 1);
  const startLine = lines[ordered.start.lineIndex] ?? "";
  const endLine = lines[ordered.end.lineIndex] ?? "";
  const prefix = startLine.slice(0, ordered.start.offset);
  const suffix = endLine.slice(ordered.end.offset);

  if (inserted.length === 1) {
    return {
      lines: [...beforeLines, prefix + inserted[0] + suffix, ...afterLines],
      focus: {
        lineIndex: ordered.start.lineIndex,
        offset: prefix.length + inserted[0].length,
      },
    };
  }

  const middle = inserted.slice(1, -1);
  const merged = [prefix + (inserted[0] ?? ""), ...middle, (inserted.at(-1) ?? "") + suffix];
  return {
    lines: [...beforeLines, ...merged, ...afterLines],
    focus: {
      lineIndex: ordered.start.lineIndex + inserted.length - 1,
      offset: inserted.at(-1)?.length ?? 0,
    },
  };
}
