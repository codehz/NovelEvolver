/**
 * Lightweight Markdown → single-line plain text for collapsed previews.
 * Heuristic only (not full CommonMark); empty/whitespace-only after strip
 * falls back to a compacted first-line of the original so callers do not
 * accidentally hide content.
 */
export function stripMarkdownPreview(source: string): string {
  const stripped = compactWhitespace(stripCommonMarkdown(source));
  if (stripped !== "") {
    return stripped;
  }
  return compactWhitespace(source.replace(/\r\n?/g, "\n").split("\n")[0] ?? "");
}

function stripCommonMarkdown(source: string): string {
  let text = source.replace(/\r\n?/g, "\n");

  // Fenced code blocks: drop fence lines, keep inner text.
  text = text.replace(/```[\w-]*\n?([\s\S]*?)```/g, (_match, body: string) => body);
  // Inline code.
  text = text.replace(/`([^`]+)`/g, "$1");
  // Images ![alt](url) → alt; links [text](url) → text.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Headings / list markers at line start.
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  text = text.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "");
  // Blockquote markers.
  text = text.replace(/^\s{0,3}>\s?/gm, "");
  // Emphasis / strong (order: double then single).
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");
  // Stray leftover emphasis markers.
  text = text.replace(/[*_~]+/g, "");

  return text;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
