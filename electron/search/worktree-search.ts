import type {
  ManuscriptSearchHit,
  ResourceSearchHit,
  WorktreeSearchQuery,
  WorktreeSearchResult,
  WorktreeSearchScope,
} from "#shared/rpc/worktree-search-rpc";

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

function normalizeScope(scope: WorktreeSearchScope | undefined): WorktreeSearchScope {
  return scope ?? "all";
}

function normalizeNeedle(query: string): string {
  return query.trim().toLowerCase();
}

function findNeedleIndex(haystack: string, needle: string): number {
  if (needle === "") {
    return -1;
  }
  return haystack.toLowerCase().indexOf(needle);
}

function normalizeLineText(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

function snippetAroundMatch(line: string, matchIndex: number, needleLength: number): string {
  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(line.length, matchIndex + needleLength + SNIPPET_CONTEXT_CHARS);
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
  needle: string,
  maxResults: number,
  getContent: (entry: TEntry) => string,
  buildHit: (entry: TEntry, line: number, column: number, snippet: string) => THit,
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
      const column = findNeedleIndex(lineText, needle);
      if (column === -1) {
        continue;
      }
      hits.push(
        buildHit(entry, index + 1, column, snippetAroundMatch(lineText, column, needle.length)),
      );
    }
  }

  return hits;
}

function searchManuscript(
  entries: Iterable<WorktreeSearchableManuscriptEntry>,
  needle: string,
  maxResults: number,
): ManuscriptSearchHit[] {
  return collectLineHits(
    entries,
    needle,
    maxResults,
    (entry) => entry.content,
    (entry, line, column, snippet) => ({
      domain: "manuscript",
      nodeId: entry.id,
      entityKind: "chapter",
      label: entry.title,
      displayPath: entry.displayPath,
      snippet,
      line,
      column,
      matchLength: needle.length,
    }),
  );
}

function searchResources(
  entries: Iterable<WorktreeSearchableResourceEntry>,
  needle: string,
  maxResults: number,
): ResourceSearchHit[] {
  return collectLineHits(
    entries,
    needle,
    maxResults,
    (entry) => (entry.type === "file" ? entry.content : ""),
    (entry, line, column, snippet) => ({
      domain: "resource",
      nodeId: entry.id,
      entityKind: "file",
      label: entry.name,
      displayPath: entry.displayPath,
      snippet,
      line,
      column,
      matchLength: needle.length,
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
  const needle = normalizeNeedle(rawQuery);
  const maxResults = options.maxResultsPerDomain ?? DEFAULT_MAX_PER_DOMAIN;

  if (needle === "") {
    return {
      query: rawQuery,
      scope,
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
    manuscript,
    resources,
  };
}
