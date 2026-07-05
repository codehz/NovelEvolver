import { useCallback, useEffect, useMemo, useState } from "react";

import type { WorktreeSearchHit, WorktreeSearchResult } from "#shared/rpc/worktree-search";

import { useManuscript, useResourceLibrary, useWorktreeSearch } from "../branch/branch-scopes";
import { useWorkbenchEditorActions } from "../editor/use-workbench-editor-actions";
import { buildSearchPathTree } from "./build-search-path-tree";
import { SEARCH_DEBOUNCE_MS, SEARCH_MAX_RESULTS_PER_DOMAIN } from "./constants";
import { formatSearchStatsLine, summarizeSearchHits } from "./search-stats";

const emptyResult = (query: string): WorktreeSearchResult => ({
  query,
  scope: "all",
  manuscript: [],
  resources: [],
});

export function useWorktreeSearchState() {
  const searchHandle = useWorktreeSearch();
  const manuscript = useManuscript();
  const resources = useResourceLibrary();
  const { openManuscriptTab, openResourceTab } = useWorkbenchEditorActions();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [result, setResult] = useState<WorktreeSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
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
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
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
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
          setResult(emptyResult(debouncedQuery));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, retryKey, searchHandle]);

  const retry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

  const statsLine = useMemo(() => {
    if (debouncedQuery === "") {
      return null;
    }
    const manuscriptHits = result?.manuscript ?? [];
    const resourceHits = result?.resources ?? [];
    const manuscriptStats = formatSearchStatsLine(summarizeSearchHits(manuscriptHits));
    const resourceStats = formatSearchStatsLine(summarizeSearchHits(resourceHits));
    return `正文：${manuscriptStats} · 资源：${resourceStats}`;
  }, [debouncedQuery, result]);

  const manuscriptTree = useMemo(
    () => buildSearchPathTree(result?.manuscript ?? []),
    [result?.manuscript],
  );
  const resourceTree = useMemo(
    () => buildSearchPathTree(result?.resources ?? []),
    [result?.resources],
  );

  const openHit = useCallback(
    (hit: WorktreeSearchHit) => {
      if (hit.domain === "manuscript" && hit.entityKind === "chapter") {
        void openManuscriptTab(hit.nodeId, hit.label, (chapterId) =>
          manuscript.readChapter(chapterId),
        );
        return;
      }
      if (hit.domain === "resource" && hit.entityKind === "file") {
        void openResourceTab(hit.nodeId, hit.label, (resourceId) => resources.readFile(resourceId));
      }
    },
    [manuscript, openManuscriptTab, openResourceTab, resources],
  );

  return {
    query,
    setQuery,
    debouncedQuery,
    loading,
    error,
    result,
    statsLine,
    manuscriptTree,
    resourceTree,
    retry,
    openHit,
  };
}
