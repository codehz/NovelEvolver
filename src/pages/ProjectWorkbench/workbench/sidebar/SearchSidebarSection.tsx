import {
  SidebarHeaderActions,
  SidebarHeaderActionButton,
  ErrorRetryView,
} from "#app/components/workbench";

import { SearchQueryChrome } from "../search/SearchQueryChrome";
import { SearchResultTree } from "../search/SearchResultTree";
import { useWorktreeSearchState } from "../search/use-worktree-search-state";

export function SearchSidebarSection() {
  const { query, setQuery, highlightQuery, status, statsLine, roots, retry, canRefresh, openHit } =
    useWorktreeSearchState();

  return (
    <>
      <SidebarHeaderActions>
        <SidebarHeaderActionButton
          label="刷新搜索结果"
          icon="icon-[codicon--refresh]"
          disabled={!canRefresh}
          onClick={retry}
        />
      </SidebarHeaderActions>
      <div className="flex min-h-0 flex-1 flex-col">
        <SearchQueryChrome query={query} statsLine={statsLine} onQueryChange={setQuery} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SearchResultTree
            status={status}
            idleContent={<p className="px-5 py-2 text-xs text-ctp-subtext0">输入内容开始搜索。</p>}
            loadingContent={<p className="px-5 py-2 text-xs text-ctp-subtext0">搜索中…</p>}
            errorContent={<ErrorRetryView message="无法加载搜索结果。" onRetry={retry} />}
            emptyContent={<p className="px-5 py-2 text-xs text-ctp-subtext0">未找到结果。</p>}
            roots={roots}
            highlightQuery={highlightQuery}
            onOpenHit={openHit}
          />
        </div>
      </div>
    </>
  );
}
