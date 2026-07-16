export type SearchSnippetPart =
  | { kind: "text"; text: string }
  | { kind: "match"; text: string }
  | { kind: "match-old"; text: string }
  | { kind: "match-new"; text: string };

export type BuildSearchSnippetPartsInput = {
  snippetBefore: string;
  matchText: string;
  snippetAfter: string;
  /** When true and replacement is provided, render old→new inline preview. */
  showReplacePreview?: boolean;
  /** Literal replacement preview (regex `$n` is shown as-is; not expanded). */
  replacement?: string;
};

/**
 * Build renderable snippet parts for one search hit.
 * Only highlights the hit's own match; optional replace preview is literal.
 */
export function buildSearchSnippetParts(input: BuildSearchSnippetPartsInput): SearchSnippetPart[] {
  const parts: SearchSnippetPart[] = [];
  if (input.snippetBefore !== "") {
    parts.push({ kind: "text", text: input.snippetBefore });
  }

  const replacement = input.replacement;
  const showReplace = input.showReplacePreview === true && replacement !== undefined;
  if (showReplace) {
    if (input.matchText !== "") {
      parts.push({ kind: "match-old", text: input.matchText });
    }
    // Always show the insertion side so zero-width / empty-string replace is visible.
    parts.push({ kind: "match-new", text: replacement });
  } else if (input.matchText !== "") {
    parts.push({ kind: "match", text: input.matchText });
  }

  if (input.snippetAfter !== "") {
    parts.push({ kind: "text", text: input.snippetAfter });
  }

  return parts;
}
