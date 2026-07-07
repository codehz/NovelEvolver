import { useCallback, useEffect, useMemo, useState } from "react";

import type { WorktreeSearchHit, WorktreeSearchResult } from "#shared/rpc/worktree-search-rpc";
import type { TreeBodyStatus } from "#workbench/tree/TreeBody";

import { useWorktreeSearch } from "../branch/branch-scopes";
import type { WorkbenchEditorNavigationRequest } from "../editor/state/types";
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

function createSearchHitNavigation(
  hit: WorktreeSearchHit,
): Omit<WorkbenchEditorNavigationRequest, "targetKey"> {
  return {
    kind: "text-range",
    selection: {
      anchor: { lineIndex: hit.line - 1, offset: hit.column },
      focus: { lineIndex: hit.line - 1, offset: hit.column + hit.matchLength },
    },
  };
}

export function useWorktreeSearchState() {
  const searchHandle = useWorktreeSearch();
  const { focusTarget, openTarget } = useWorkbenchEditorActions();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [result, setResult] = useState<WorktreeSearchResult | null>(null);
  const [status, setStatus] = useState<TreeBodyStatus>("idle");
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
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    searchHandle
      .search({
        query: debouncedQuery,
        scope: "all",
        maxResultsPerDomain: SEARCH_MAX_RESULTS_PER_DOMAIN,
      })
      .then((next) => {
        if (!cancelled) {
          setResult(next);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult(emptyResult(debouncedQuery));
          setStatus("error");
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
    if (debouncedQuery === "") {
      return "请输入搜索内容";
    }
    if (status === "loading") {
      return null;
    }
    if (status === "error") {
      return "搜索失败";
    }
    const allHits = [...(result?.manuscript ?? []), ...(result?.resources ?? [])];
    return formatSearchStatsLine(summarizeSearchHits(allHits));
  }, [debouncedQuery, result, status]);

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
      const options = {
        navigation: createSearchHitNavigation(hit),
      };
      if (hit.domain === "manuscript" && hit.entityKind === "chapter") {
        const target = { kind: "manuscript" as const, chapterId: hit.nodeId };
        if (intent === "focus") {
          focusTarget(target, options);
          return;
        }
        openTarget(target, options);
        return;
      }
      if (hit.domain === "resource" && hit.entityKind === "file") {
        const target = { kind: "resource" as const, resourceId: hit.nodeId };
        if (intent === "focus") {
          focusTarget(target, options);
          return;
        }
        openTarget(target, options);
      }
    },
    [focusTarget, openTarget],
  );

  return {
    query,
    setQuery,
    status,
    highlightQuery: debouncedQuery,
    statsLine,
    roots,
    retry,
    canRefresh: query.trim() !== "",
    openHit,
  };
}
