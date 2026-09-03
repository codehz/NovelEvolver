export type ComparisonLineKind = "unchanged" | "added" | "removed";

export type ComparisonLine = {
  id: string;
  kind: ComparisonLineKind;
  number: number | null;
  text: string;
};

export type ComparisonHunk = {
  id: string;
  lines: ComparisonLine[];
  currentStart: number;
  currentEnd: number;
  originalContent: string;
  restoredContent: string;
};

export type ChangeComparisonModel = {
  lines: ComparisonLine[];
  hunks: ComparisonHunk[];
};

type DiffOperation =
  | { kind: "equal"; original: string; current: string }
  | { kind: "add"; current: string }
  | { kind: "remove"; original: string };

function splitLines(content: string): string[] {
  if (content === "") return [];
  return content.match(/[^\n]*(?:\n|$)/g)?.filter((line) => line !== "") ?? [];
}

function displayLine(line: string): string {
  return line.endsWith("\n") ? line.slice(0, -1) : line;
}

function diffLines(original: string[], current: string[]): DiffOperation[] {
  const lengths = Array.from({ length: original.length + 1 }, () =>
    Array.from({ length: current.length + 1 }, () => 0),
  );
  for (let originalIndex = original.length - 1; originalIndex >= 0; originalIndex -= 1) {
    for (let currentIndex = current.length - 1; currentIndex >= 0; currentIndex -= 1) {
      lengths[originalIndex][currentIndex] =
        original[originalIndex] === current[currentIndex]
          ? 1 + lengths[originalIndex + 1][currentIndex + 1]
          : Math.max(
              lengths[originalIndex + 1][currentIndex],
              lengths[originalIndex][currentIndex + 1],
            );
    }
  }

  const operations: DiffOperation[] = [];
  let originalIndex = 0;
  let currentIndex = 0;
  while (originalIndex < original.length || currentIndex < current.length) {
    if (
      originalIndex < original.length &&
      currentIndex < current.length &&
      original[originalIndex] === current[currentIndex]
    ) {
      operations.push({
        kind: "equal",
        original: original[originalIndex],
        current: current[currentIndex],
      });
      originalIndex += 1;
      currentIndex += 1;
    } else if (
      currentIndex < current.length &&
      (originalIndex === original.length ||
        lengths[originalIndex][currentIndex + 1] > lengths[originalIndex + 1][currentIndex])
    ) {
      operations.push({ kind: "add", current: current[currentIndex] });
      currentIndex += 1;
    } else {
      operations.push({ kind: "remove", original: original[originalIndex] });
      originalIndex += 1;
    }
  }
  return operations;
}

function operationLine(
  operation: DiffOperation,
  index: number,
  currentLineNumber: number,
): ComparisonLine {
  if (operation.kind === "equal") {
    return {
      id: `equal:${index}`,
      kind: "unchanged",
      number: currentLineNumber,
      text: displayLine(operation.current),
    };
  }
  if (operation.kind === "add") {
    return {
      id: `add:${index}`,
      kind: "added",
      number: currentLineNumber,
      text: displayLine(operation.current),
    };
  }
  return {
    id: `remove:${index}`,
    kind: "removed",
    number: null,
    text: displayLine(operation.original),
  };
}

function changedRanges(operations: DiffOperation[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let index = 0;
  while (index < operations.length) {
    if (operations[index].kind === "equal") {
      index += 1;
      continue;
    }
    const start = index;
    while (index < operations.length && operations[index].kind !== "equal") index += 1;
    ranges.push([start, index]);
  }
  return ranges;
}

function hunkRanges(operations: DiffOperation[]): Array<[number, number]> {
  const ranges = changedRanges(operations);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of ranges) {
    const previous = merged.at(-1);
    if (previous !== undefined && start - previous[1] < 3) {
      previous[1] = end;
    } else {
      merged.push([start, end]);
    }
  }
  return merged.map(([start, end]) => [
    Math.max(0, start - 2),
    Math.min(operations.length, end + 2),
  ]);
}

export function buildChangeComparisonModel(
  originalContent: string,
  currentContent: string,
): ChangeComparisonModel {
  const originalLines = splitLines(originalContent);
  const currentLines = splitLines(currentContent);
  const operations = diffLines(originalLines, currentLines);
  const lines: ComparisonLine[] = [];
  let currentLineNumber = 1;
  for (const [index, operation] of operations.entries()) {
    lines.push(operationLine(operation, index, currentLineNumber));
    if (operation.kind !== "remove") currentLineNumber += 1;
  }

  const hunks = hunkRanges(operations).map(([start, end], hunkIndex) => {
    let currentStart = 0;
    for (const operation of operations.slice(0, start)) {
      if (operation.kind !== "remove") currentStart += 1;
    }
    let currentEnd = currentStart;
    for (const operation of operations.slice(start, end)) {
      if (operation.kind !== "remove") currentEnd += 1;
    }
    const originalHunk = operations
      .slice(start, end)
      .filter((operation) => operation.kind !== "add")
      .map((operation) => operation.original)
      .join("");
    const currentHunk = operations
      .slice(start, end)
      .filter((operation) => operation.kind !== "remove")
      .map((operation) => operation.current)
      .join("");
    const restoredContent =
      currentLines.slice(0, currentStart).join("") +
      originalHunk +
      currentLines.slice(currentEnd).join("");
    return {
      id: `hunk:${hunkIndex}`,
      lines: lines.slice(start, end),
      currentStart,
      currentEnd,
      originalContent: currentHunk,
      restoredContent,
    };
  });

  return { lines, hunks };
}
