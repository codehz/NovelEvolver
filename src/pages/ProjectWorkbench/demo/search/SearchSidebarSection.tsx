import { useMemo } from "react";

import { cn } from "#app/lib/cn";

import { ScmDiffError, ScmDiffLoading } from "../scm/ScmDiffStatusViews";
import { SearchQueryChrome } from "./SearchQueryChrome";
import { SearchResultTree, type SearchResultDomainRoot } from "./SearchResultTree";
import { useWorktreeSearchState } from "./use-worktree-search-state";

export function SearchSidebarSection() {
  const {
    query,
    setQuery,
    debouncedQuery,
    loading,
    error,
    statsLine,
    manuscriptTree,
    resourceTree,
    retry,
    openHit,
  } = useWorktreeSearchState();

  const roots = useMemo((): SearchResultDomainRoot[] => {
    const list: SearchResultDomainRoot[] = [];
    if (manuscriptTree.length > 0) {
      list.push({
        id: "manuscript",
        title: "正文",
        iconClass: cn("icon-[codicon--book]", "text-ctp-blue"),
        nodes: manuscriptTree,
      });
    }
    if (resourceTree.length > 0) {
      list.push({
        id: "resources",
        title: "资源库",
        iconClass: cn("icon-[codicon--folder]", "text-ctp-mauve"),
        nodes: resourceTree,
      });
    }
    return list;
  }, [manuscriptTree, resourceTree]);

  const hasQuery = debouncedQuery !== "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SearchQueryChrome
        query={query}
        statsLine={statsLine}
        loading={loading}
        onQueryChange={setQuery}
      />
      <div className="-m-2 flex min-h-0 flex-1 flex-col overflow-hidden">
        {!hasQuery ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-6 text-center text-xs text-ctp-subtext0">
            <p className="text-ctp-overlay0">在上方输入关键词</p>
          </div>
        ) : loading && roots.length === 0 ? (
          <ScmDiffLoading />
        ) : error && roots.length === 0 ? (
          <ScmDiffError onRetry={retry} />
        ) : roots.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
            <span
              aria-hidden="true"
              className="icon-[codicon--search] text-2xl text-ctp-overlay0"
            />
            <p>无匹配结果</p>
          </div>
        ) : (
          <SearchResultTree roots={roots} onOpenHit={openHit} />
        )}
      </div>
    </div>
  );
}
