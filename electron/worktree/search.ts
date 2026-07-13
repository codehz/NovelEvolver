import type {
  ManuscriptSearchHit,
  ResourceSearchHit,
  WorktreeSearchQuery,
  WorktreeSearchResult,
  WorktreeSearchScope,
} from "#shared/rpc/worktree/index";

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

type CompiledNeedle = { kind: "literal"; needle: string } | { kind: "regex"; pattern: RegExp };

type LineMatch = {
  index: number;
  length: number;
};

function normalizeScope(scope: WorktreeSearchScope | undefined): WorktreeSearchScope {
  return scope ?? "all";
}

function compileNeedle(query: string, isRegex: boolean): CompiledNeedle | null {
  const trimmed = query.trim();
  if (trimmed === "") {
    return null;
  }
  if (!isRegex) {
    return { kind: "literal", needle: trimmed.toLowerCase() };
  }
  try {
    // 与字面搜索一致：大小写不敏感；`u` 便于 Unicode 属性类。
    return { kind: "regex", pattern: new RegExp(trimmed, "iu") };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`无效的正则表达式: ${detail}`);
  }
}

function findLineMatch(haystack: string, needle: CompiledNeedle): LineMatch | null {
  if (needle.kind === "literal") {
    if (needle.needle === "") {
      return null;
    }
    const index = haystack.toLowerCase().indexOf(needle.needle);
    if (index === -1) {
      return null;
    }
    return { index, length: needle.needle.length };
  }

  const match = needle.pattern.exec(haystack);
  if (match === null || match[0] === undefined || match[0].length === 0) {
    // 零宽匹配（如 `^` / `(?=x)`）对定位无意义，跳过。
    return null;
  }
  return { index: match.index, length: match[0].length };
}

function normalizeLineText(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

function snippetAroundMatch(line: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(line.length, matchIndex + matchLength + SNIPPET_CONTEXT_CHARS);
  let snippet = line.slice(start, end);
  if (start > 0) {
    snippet = `…${snippet}`;
  }
  if (end < line.length) {
    snippet = `${snippet}…`;
  }
  return snippet;
}

function collectLineHits<
  TEntry,
  THit extends { snippet: string; line: number; column: number; matchLength: number },
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
    snippet: string,
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
    for (const [index, rawLine] of lines.entries()) {
      if (hits.length >= maxResults) {
        break;
      }
      const lineText = normalizeLineText(rawLine);
      const match = findLineMatch(lineText, needle);
      if (match === null) {
        continue;
      }
      hits.push(
        buildHit(
          entry,
          index + 1,
          match.index,
          match.length,
          snippetAroundMatch(lineText, match.index, match.length),
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
    (entry, line, column, matchLength, snippet) => ({
      domain: "manuscript",
      nodeId: entry.id,
      entityKind: "chapter",
      label: entry.title,
      displayPath: entry.displayPath,
      snippet,
      line,
      column,
      matchLength,
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
    (entry, line, column, matchLength, snippet) => ({
      domain: "resource",
      nodeId: entry.id,
      entityKind: "file",
      label: entry.name,
      displayPath: entry.displayPath,
      snippet,
      line,
      column,
      matchLength,
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
