import type { VirtualWorktree } from "nano-git/worktree/core";

import type {
  ManuscriptSearchHit,
  ResourceSearchHit,
  WorktreeSearchQuery,
  WorktreeSearchResult,
  WorktreeSearchScope,
} from "#shared/rpc/worktree-search";

import { createEmptyOutline, parseOutline } from "../manuscript-outline";
import { chapterBodyPath, MANUSCRIPT_OUTLINE_PATH } from "../manuscript-path";
import { ensureResourcesDirectory, RESOURCES_DIR, toWorktreePath } from "../resource-library-path";

const DEFAULT_MAX_PER_DOMAIN = 100;
const SNIPPET_CONTEXT_CHARS = 48;

type ManuscriptSearchEntry = {
  id: string;
  title: string;
  displayPath: string;
  content: string;
};

type ResourceSearchEntry = {
  path: string;
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

function readManuscriptEntries(worktree: VirtualWorktree): ManuscriptSearchEntry[] {
  if (!worktree.exists(MANUSCRIPT_OUTLINE_PATH)) {
    return [];
  }
  const outline =
    worktree.stat(MANUSCRIPT_OUTLINE_PATH)?.kind === "blob"
      ? parseOutline(worktree.readFile(MANUSCRIPT_OUTLINE_PATH).toString("utf-8"))
      : createEmptyOutline();

  const entries: ManuscriptSearchEntry[] = [];

  const visit = (parentId: string, parentPath: string): void => {
    const parent = outline.nodes[parentId];
    if (parent?.type !== "folder") {
      return;
    }
    for (const childId of parent.children) {
      const node = outline.nodes[childId];
      if (node === undefined || childId === outline.rootId) {
        continue;
      }
      const displayPath = parentPath === "" ? node.title : `${parentPath}/${node.title}`;
      const content =
        node.type === "chapter" && worktree.exists(chapterBodyPath(node.id))
          ? worktree.readFile(chapterBodyPath(node.id)).toString("utf-8")
          : "";
      if (node.type === "chapter") {
        entries.push({
          id: node.id,
          title: node.title,
          displayPath,
          content,
        });
      }
      if (node.type === "folder") {
        visit(node.id, displayPath);
      }
    }
  };

  visit(outline.rootId, "");
  return entries;
}

function sortWorktreeEntries(
  entries: Array<{ name: string; kind: string }>,
): Array<{ name: string; kind: string }> {
  return [...entries].sort((left, right) => {
    if (left.kind === right.kind) {
      return left.name.localeCompare(right.name);
    }
    return left.kind === "tree" ? -1 : 1;
  });
}

function readResourceEntries(worktree: VirtualWorktree): ResourceSearchEntry[] {
  if (!worktree.exists(RESOURCES_DIR)) {
    return [];
  }
  ensureResourcesDirectory(worktree);
  const entries: ResourceSearchEntry[] = [];

  const visit = (resourcePath: string): void => {
    const worktreePath = resourcePath === "" ? RESOURCES_DIR : toWorktreePath(resourcePath);
    const dirEntries = sortWorktreeEntries(
      worktree
        .readdir(worktreePath)
        .filter((entry) => entry.kind === "blob" || entry.kind === "tree"),
    );

    for (const dirEntry of dirEntries) {
      const childPath = resourcePath === "" ? dirEntry.name : `${resourcePath}/${dirEntry.name}`;
      if (dirEntry.kind === "blob") {
        entries.push({
          path: childPath,
          name: dirEntry.name,
          displayPath: childPath,
          content: worktree.readFile(toWorktreePath(childPath)).toString("utf-8"),
        });
      } else {
        visit(childPath);
      }
    }
  };

  visit("");
  return entries;
}

function searchManuscript(
  entries: ManuscriptSearchEntry[],
  needle: string,
  maxResults: number,
): ManuscriptSearchHit[] {
  const hits: ManuscriptSearchHit[] = [];

  for (const entry of entries) {
    if (hits.length >= maxResults) {
      break;
    }

    if (entry.content === "") {
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
  entries: ResourceSearchEntry[],
  resourceIdByPath: ReadonlyMap<string, string>,
  needle: string,
  maxResults: number,
): ResourceSearchHit[] {
  const hits: ResourceSearchHit[] = [];

  for (const entry of entries) {
    if (hits.length >= maxResults) {
      break;
    }

    const nodeId = resourceIdByPath.get(entry.path);
    if (nodeId === undefined) {
      continue;
    }

    if (entry.content === "") {
      continue;
    }

    const contentIndex = findNeedleIndex(entry.content, needle);
    if (contentIndex === -1) {
      continue;
    }

    const { line, column } = lineColumnAtOffset(entry.content, contentIndex);
    hits.push({
      domain: "resource",
      nodeId,
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
  worktree: VirtualWorktree,
  resourceIdByPath: ReadonlyMap<string, string>,
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

  const searchManuscriptDomain = scope === "all" || scope === "manuscript";
  const searchResourceDomain = scope === "all" || scope === "resource";

  const manuscript = searchManuscriptDomain
    ? searchManuscript(readManuscriptEntries(worktree), needle, maxResults)
    : [];

  const resources = searchResourceDomain
    ? searchResources(readResourceEntries(worktree), resourceIdByPath, needle, maxResults)
    : [];

  return {
    query: rawQuery,
    scope,
    manuscript,
    resources,
  };
}
