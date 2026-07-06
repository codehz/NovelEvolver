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

function lineColumnAtOffset(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const lineBreaks = before.split("\n");
  const line = lineBreaks.length;
  const column = lineBreaks[lineBreaks.length - 1]!.length;
  return { line, column };
}

function snippetAroundMatch(text: string, matchIndex: number, needleLength: number): string {
  const start = Math.max(0, matchIndex - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(text.length, matchIndex + needleLength + SNIPPET_CONTEXT_CHARS);
  let snippet = text.slice(start, end).replace(/\n/g, " ");
  if (start > 0) {
    snippet = `…${snippet}`;
  }
  if (end < text.length) {
    snippet = `${snippet}…`;
  }
  return snippet;
}

function searchManuscript(
  entries: Iterable<WorktreeSearchableManuscriptEntry>,
  needle: string,
  maxResults: number,
): ManuscriptSearchHit[] {
  const hits: ManuscriptSearchHit[] = [];

  for (const entry of entries) {
    if (hits.length >= maxResults || entry.content === "") {
      continue;
    }

    const contentIndex = findNeedleIndex(entry.content, needle);
    if (contentIndex === -1) {
      continue;
    }

    const { line, column } = lineColumnAtOffset(entry.content, contentIndex);
    hits.push({
      domain: "manuscript",
      nodeId: entry.id,
      entityKind: "chapter",
      label: entry.title,
      displayPath: entry.displayPath,
      snippet: snippetAroundMatch(entry.content, contentIndex, needle.length),
      line,
      column,
    });
  }

  return hits;
}

function searchResources(
  entries: Iterable<WorktreeSearchableResourceEntry>,
  needle: string,
  maxResults: number,
): ResourceSearchHit[] {
  const hits: ResourceSearchHit[] = [];

  for (const entry of entries) {
    if (hits.length >= maxResults || entry.type !== "file" || entry.content === "") {
      continue;
    }

    const contentIndex = findNeedleIndex(entry.content, needle);
    if (contentIndex === -1) {
      continue;
    }

    const { line, column } = lineColumnAtOffset(entry.content, contentIndex);
    hits.push({
      domain: "resource",
      nodeId: entry.id,
      entityKind: "file",
      label: entry.name,
      displayPath: entry.displayPath,
      snippet: snippetAroundMatch(entry.content, contentIndex, needle.length),
      line,
      column,
    });
  }

  return hits;
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
