import type {
  ManuscriptSearchHit,
  ResourceSearchHit,
  WorktreeSearchQuery,
  WorktreeSearchResult,
  WorktreeSearchScope,
} from "#domain/worktree";

const DEFAULT_MAX_PER_DOMAIN = 100;
const SNIPPET_CONTEXT_CHARS = 48;

export type WorktreeSearchableManuscriptEntry = {
  id: string;
  title: string;
  displayPath: string;
  content: string;
};

export type WorktreeSearchableResourceEntry = {
  id: string;
  type: "folder" | "file";
  name: string;
  displayPath: string;
  content: string;
};

export type CompiledNeedle =
  | { kind: "literal"; needle: string }
  | { kind: "regex"; pattern: RegExp };

export type ContentMatch = {
  start: number;
  length: number;
  line: number;
  column: number;
  /** Original matched span (for replacement splicing / $&). */
  text: string;
  /** Regex captures for `$n` expansion; null for literal matches. */
  regexMatch: RegExpExecArray | null;
};

type LineMatch = {
  index: number;
  length: number;
  text: string;
  regexMatch: RegExpExecArray | null;
};

function normalizeScope(scope: WorktreeSearchScope | undefined): WorktreeSearchScope {
  return scope ?? "all";
}

export function compileNeedle(query: string, isRegex: boolean): CompiledNeedle | null {
  const trimmed = query.trim();
  if (trimmed === "") {
    return null;
  }
  if (!isRegex) {
    return { kind: "literal", needle: trimmed.toLowerCase() };
  }
  try {
    // 与字面搜索一致：大小写不敏感；`u` 便于 Unicode 属性类。
    // 不用 `m`：搜索按行执行，`^`/`$` 自然锚定行首尾；整文加 `m` 还会在 CRLF 上双重命中。
    return { kind: "regex", pattern: new RegExp(trimmed, "iu") };
  } catch {
    throw new Error("无效正则表达式");
  }
}

/**
 * Case-insensitive literal scan over the original UTF-16 string.
 * Walks original code units so `toLowerCase()` length changes (e.g. `İ`) do not
 * corrupt start/length indices used for slicing.
 */
function findLiteralLineMatches(haystack: string, needleLower: string): LineMatch[] {
  if (needleLower === "" || haystack === "") {
    return [];
  }

  const matches: LineMatch[] = [];
  let index = 0;
  while (index < haystack.length) {
    let contentIndex = index;
    let needleIndex = 0;
    while (needleIndex < needleLower.length && contentIndex < haystack.length) {
      const folded = haystack[contentIndex]!.toLowerCase();
      if (!needleLower.startsWith(folded, needleIndex)) {
        break;
      }
      needleIndex += folded.length;
      contentIndex += 1;
    }
    if (needleIndex === needleLower.length) {
      const length = contentIndex - index;
      matches.push({
        index,
        length,
        text: haystack.slice(index, contentIndex),
        regexMatch: null,
      });
      index = contentIndex;
      continue;
    }
    index += 1;
  }
  return matches;
}

function findRegexLineMatches(haystack: string, patternSource: RegExp): LineMatch[] {
  const matches: LineMatch[] = [];
  const flags = patternSource.flags.includes("g") ? patternSource.flags : `${patternSource.flags}g`;
  const pattern = new RegExp(patternSource.source, flags);
  pattern.lastIndex = 0;
  let match = pattern.exec(haystack);
  while (match !== null) {
    // Record zero-width hits too (`^`, `$`, `\b`, `^$`) so replace can target
    // empty lines and boundaries; still advance lastIndex by 1 to avoid loops.
    const text = match[0] ?? "";
    matches.push({
      index: match.index,
      length: text.length,
      text,
      regexMatch: match,
    });
    if (pattern.lastIndex === match.index) {
      pattern.lastIndex = match.index + 1;
    }
    match = pattern.exec(haystack);
  }
  return matches;
}

function findLineMatches(haystack: string, needle: CompiledNeedle): LineMatch[] {
  if (needle.kind === "literal") {
    return findLiteralLineMatches(haystack, needle.needle);
  }
  return findRegexLineMatches(haystack, needle.pattern);
}

export function findAllMatches(content: string, needle: CompiledNeedle): ContentMatch[] {
  if (content === "") {
    return [];
  }

  const results: ContentMatch[] = [];
  const lines = content.split("\n");
  let baseOffset = 0;

  for (const [index, rawLine] of lines.entries()) {
    const lineText = normalizeLineText(rawLine);
    for (const match of findLineMatches(lineText, needle)) {
      results.push({
        start: baseOffset + match.index,
        length: match.length,
        line: index + 1,
        column: match.index,
        text: match.text,
        regexMatch: match.regexMatch,
      });
    }
    baseOffset += rawLine.length + 1;
  }

  return results;
}

function normalizeLineText(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

type SearchSnippetParts = {
  snippet: string;
  snippetBefore: string;
  matchText: string;
  snippetAfter: string;
};

function snippetAroundMatch(
  line: string,
  matchIndex: number,
  matchLength: number,
): SearchSnippetParts {
  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_CHARS);
  const matchEnd = matchIndex + matchLength;
  const end = Math.min(line.length, matchEnd + SNIPPET_CONTEXT_CHARS);

  let snippetBefore = line.slice(start, matchIndex);
  if (start > 0) {
    snippetBefore = `…${snippetBefore}`;
  }

  const matchText = line.slice(matchIndex, matchEnd);

  let snippetAfter = line.slice(matchEnd, end);
  if (end < line.length) {
    snippetAfter = `${snippetAfter}…`;
  }

  return {
    snippetBefore,
    matchText,
    snippetAfter,
    snippet: `${snippetBefore}${matchText}${snippetAfter}`,
  };
}

function collectLineHits<
  TEntry,
  THit extends {
    snippet: string;
    snippetBefore: string;
    matchText: string;
    snippetAfter: string;
    line: number;
    column: number;
    matchLength: number;
    matchStart: number;
  },
>(
  entries: Iterable<TEntry>,
  needle: CompiledNeedle,
  maxResults: number,
  getContent: (entry: TEntry) => string,
  buildHit: (
    entry: TEntry,
    line: number,
    column: number,
    matchLength: number,
    matchStart: number,
    parts: SearchSnippetParts,
  ) => THit,
): THit[] {
  const hits: THit[] = [];

  for (const entry of entries) {
    if (hits.length >= maxResults) {
      break;
    }

    const content = getContent(entry);
    if (content === "") {
      continue;
    }

    const lines = content.split("\n");
    for (const match of findAllMatches(content, needle)) {
      if (hits.length >= maxResults) {
        break;
      }
      const rawLine = lines[match.line - 1] ?? "";
      const lineText = normalizeLineText(rawLine);
      hits.push(
        buildHit(
          entry,
          match.line,
          match.column,
          match.length,
          match.start,
          snippetAroundMatch(lineText, match.column, match.length),
        ),
      );
    }
  }

  return hits;
}

function searchManuscript(
  entries: Iterable<WorktreeSearchableManuscriptEntry>,
  needle: CompiledNeedle,
  maxResults: number,
): ManuscriptSearchHit[] {
  return collectLineHits(
    entries,
    needle,
    maxResults,
    (entry) => entry.content,
    (entry, line, column, matchLength, matchStart, parts) => ({
      domain: "manuscript",
      nodeId: entry.id,
      entityKind: "chapter",
      label: entry.title,
      displayPath: entry.displayPath,
      ...parts,
      line,
      column,
      matchLength,
      matchStart,
    }),
  );
}

function searchResources(
  entries: Iterable<WorktreeSearchableResourceEntry>,
  needle: CompiledNeedle,
  maxResults: number,
): ResourceSearchHit[] {
  return collectLineHits(
    entries,
    needle,
    maxResults,
    (entry) => (entry.type === "file" ? entry.content : ""),
    (entry, line, column, matchLength, matchStart, parts) => ({
      domain: "resource",
      nodeId: entry.id,
      entityKind: "file",
      label: entry.name,
      displayPath: entry.displayPath,
      ...parts,
      line,
      column,
      matchLength,
      matchStart,
    }),
  );
}

export function executeWorktreeSearch(
  manuscriptEntries: Iterable<WorktreeSearchableManuscriptEntry>,
  resourceEntries: Iterable<WorktreeSearchableResourceEntry>,
  options: WorktreeSearchQuery,
): WorktreeSearchResult {
  const scope = normalizeScope(options.scope);
  const rawQuery = options.query;
  const isRegex = options.isRegex === true;
  const needle = compileNeedle(rawQuery, isRegex);
  const maxResults = options.maxResultsPerDomain ?? DEFAULT_MAX_PER_DOMAIN;

  if (needle === null) {
    return {
      query: rawQuery,
      scope,
      isRegex,
      manuscript: [],
      resources: [],
    };
  }

  const manuscript =
    scope === "all" || scope === "manuscript"
      ? searchManuscript(manuscriptEntries, needle, maxResults)
      : [];

  const resources =
    scope === "all" || scope === "resource"
      ? searchResources(resourceEntries, needle, maxResults)
      : [];

  return {
    query: rawQuery,
    scope,
    isRegex,
    manuscript,
    resources,
  };
}
