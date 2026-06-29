const PHYSICAL_LINE_SELECTOR = "[data-physical-line]";

export const PLAIN_TEXT_EDITOR_LINE_CLASS = "plain-text-editor-line";

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

  return blocks.map((block) => block.textContent ?? "");
}

export function normalizeEditorDom(root: HTMLElement, lineBlockClass: string): void {
  let blocks = getPhysicalLineBlocks(root);

  if (blocks.length === 0) {
    const fallback = document.createElement("div");
    fallback.dataset.physicalLine = "true";
    fallback.className = lineBlockClass;
    if ((root.textContent ?? "").length === 0) {
      fallback.appendChild(document.createElement("br"));
    } else {
      fallback.textContent = root.textContent;
    }
    root.replaceChildren(fallback);
    return;
  }

  blocks.forEach((block) => {
    block.dataset.physicalLine = "true";
    block.className = lineBlockClass;
    if ((block.textContent ?? "").length === 0 && block.childElementCount === 0) {
      block.replaceChildren(document.createElement("br"));
    }
  });
}

export function writePhysicalLinesToEditor(
  root: HTMLElement,
  lines: string[],
  lineBlockClass: string,
): void {
  root.replaceChildren(
    ...lines.map((line) => {
      const block = document.createElement("div");
      block.dataset.physicalLine = "true";
      block.className = lineBlockClass;
      if (line.length === 0) {
        block.appendChild(document.createElement("br"));
      } else {
        block.textContent = line;
      }
      return block;
    }),
  );
}

export function applyPlainTextPaste(
  root: HTMLElement,
  pasted: string,
  lineBlockClass: string,
): void {
  normalizeEditorDom(root, lineBlockClass);
  const normalized = pasted.replace(/\r\n/g, "\n");
  const inserted = splitPlainTextDocument(normalized);
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    writePhysicalLinesToEditor(root, inserted, lineBlockClass);
    return;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) {
    writePhysicalLinesToEditor(root, inserted, lineBlockClass);
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

  writePhysicalLinesToEditor(root, next, lineBlockClass);
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
    if (!block.contains(range.startContainer) && block !== range.startContainer) {
      continue;
    }

    const prefix = range.cloneRange();
    prefix.selectNodeContents(block);
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

  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
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
  range.selectNodeContents(block);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}
