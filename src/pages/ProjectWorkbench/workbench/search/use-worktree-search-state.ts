import { useCallback, useEffect, useMemo, useState } from "react";

import type { WorktreeSearchHit, WorktreeSearchResult } from "#shared/rpc/worktree-search-rpc";

import { useWorktreeSearch } from "../branch/branch-scopes";
import { useWorkbenchEditorActions } from "../editor/use-workbench-editor-actions";
import { contentDomainIconClass } from "../tree/content-tree-icons";
import { buildSearchPathTree } from "./build-search-path-tree";
import { SEARCH_DEBOUNCE_MS, SEARCH_MAX_RESULTS_PER_DOMAIN } from "./constants";
import { formatSearchStatsLine, summarizeSearchHits } from "./search-stats";
import type { SearchResultDomainRoot } from "./SearchResultTree";

const emptyResult = (query: string): WorktreeSearchResult => ({
  query,
  scope: "all",
  manuscript: [],
  resources: [],
});

export function useWorktreeSearchState() {
  const searchHandle = useWorktreeSearch();
  const { focusTarget, openTarget } = useWorkbenchEditorActions();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [result, setResult] = useState<WorktreeSearchResult | null>(null);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === "") {
      setDebouncedQuery("");
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (debouncedQuery === "") {
      setResult(null);
      setError(false);
      return;
    }

    let cancelled = false;
    setError(false);

    searchHandle
      .search({
        query: debouncedQuery,
        scope: "all",
        maxResultsPerDomain: SEARCH_MAX_RESULTS_PER_DOMAIN,
      })
      .then((next) => {
        if (!cancelled) {
          setResult(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setResult(emptyResult(debouncedQuery));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, retryKey, searchHandle]);

  const retry = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed === "") {
      return;
    }
    setDebouncedQuery(trimmed);
    setRetryKey((current) => current + 1);
  }, [query]);

  const statsLine = useMemo(() => {
    if (debouncedQuery === "" || error) {
      return null;
    }
    const allHits = [...(result?.manuscript ?? []), ...(result?.resources ?? [])];
    return formatSearchStatsLine(summarizeSearchHits(allHits));
  }, [debouncedQuery, error, result]);

  const roots = useMemo((): SearchResultDomainRoot[] => {
    const manuscriptTree = buildSearchPathTree(result?.manuscript ?? []);
    const resourceTree = buildSearchPathTree(result?.resources ?? []);
    const list: SearchResultDomainRoot[] = [];
    if (manuscriptTree.length > 0) {
      list.push({
        id: "manuscript",
        title: "正文",
        iconClass: contentDomainIconClass("manuscript"),
        nodes: manuscriptTree,
      });
    }
    if (resourceTree.length > 0) {
      list.push({
        id: "resources",
        title: "资源库",
        iconClass: contentDomainIconClass("resource"),
        nodes: resourceTree,
      });
    }
    return list;
  }, [result?.manuscript, result?.resources]);

  const openHit = useCallback(
    (hit: WorktreeSearchHit, intent: "focus" | "open") => {
      if (hit.domain === "manuscript" && hit.entityKind === "chapter") {
        const target = { kind: "manuscript" as const, chapterId: hit.nodeId };
        if (intent === "focus") {
          focusTarget(target);
          return;
        }
        openTarget(target);
        return;
      }
      if (hit.domain === "resource" && hit.entityKind === "file") {
        const target = { kind: "resource" as const, resourceId: hit.nodeId };
        if (intent === "focus") {
          focusTarget(target);
          return;
        }
        openTarget(target);
      }
    },
    [focusTarget, openTarget],
  );

  return {
    query,
    setQuery,
    highlightQuery: debouncedQuery,
    error,
    statsLine,
    roots,
    retry,
    canRefresh: query.trim() !== "",
    openHit,
  };
}
