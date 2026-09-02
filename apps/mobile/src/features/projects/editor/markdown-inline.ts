export type MarkdownTextStyle = {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  heading?: boolean;
  marker?: boolean;
  link?: boolean;
};

export type MarkdownTextSegment = {
  text: string;
  style: MarkdownTextStyle;
};

type Token = {
  close: string;
  style: keyof Pick<MarkdownTextStyle, "bold" | "italic" | "strikethrough" | "code">;
};

const tokens: Token[] = [
  { close: "**", style: "bold" },
  { close: "__", style: "bold" },
  { close: "~~", style: "strikethrough" },
  { close: "`", style: "code" },
  { close: "*", style: "italic" },
  { close: "_", style: "italic" },
];

function isEscaped(source: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function findClosing(source: string, start: number, token: Token) {
  let cursor = start;
  while (cursor < source.length) {
    const closeIndex = source.indexOf(token.close, cursor);
    if (closeIndex === -1) return -1;
    if (!isEscaped(source, closeIndex) && closeIndex > start) return closeIndex;
    cursor = closeIndex + token.close.length;
  }
  return -1;
}

function marker(text: string): MarkdownTextSegment {
  return { text, style: { marker: true } };
}

function styled(text: string, style: MarkdownTextStyle): MarkdownTextSegment {
  return { text, style };
}

function parseInlineLine(line: string): MarkdownTextSegment[] {
  const segments: MarkdownTextSegment[] = [];
  let cursor = 0;
  let plainStart = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) segments.push(styled(line.slice(plainStart, end), {}));
  };

  while (cursor < line.length) {
    if (line[cursor] === "\\" && cursor + 1 < line.length) {
      cursor += 1;
      while (cursor < line.length && "*_~`".includes(line[cursor])) cursor += 1;
      continue;
    }

    const token = tokens.find(
      (candidate) => line.startsWith(candidate.close, cursor) && !isEscaped(line, cursor),
    );
    if (!token) {
      cursor += 1;
      continue;
    }

    const closeIndex = findClosing(line, cursor + token.close.length, token);
    if (
      closeIndex === -1 ||
      (token.style !== "code" && closeIndex === cursor + token.close.length)
    ) {
      cursor += token.close.length;
      continue;
    }

    flushPlain(cursor);
    segments.push(marker(token.close));
    segments.push(
      styled(line.slice(cursor + token.close.length, closeIndex), { [token.style]: true }),
    );
    segments.push(marker(token.close));
    cursor = closeIndex + token.close.length;
    plainStart = cursor;
  }

  flushPlain(line.length);
  return segments;
}

function parseLine(line: string): MarkdownTextSegment[] {
  const heading = /^( {0,3})(#{1,6})(?=\s|$)/.exec(line);
  if (!heading) return parseInlineLine(line);

  const prefixLength = heading[0].length;
  const segments: MarkdownTextSegment[] = [];
  if (heading[1]) segments.push(styled(heading[1], {}));
  segments.push(marker(heading[2]));
  if (prefixLength < line.length) {
    segments.push(styled(line.slice(prefixLength), { bold: true, heading: true }));
  }
  return segments;
}

/**
 * Produces source-preserving spans for the editor overlay. Unclosed syntax is
 * left plain so a partially typed delimiter never changes the text layout.
 */
export function parseMarkdownForEditor(source: string): MarkdownTextSegment[] {
  if (source.length === 0) return [];

  return source.split("\n").flatMap((line, index, lines) => {
    const segments = parseLine(line);
    return index === lines.length - 1 ? segments : [...segments, styled("\n", {})];
  });
}
