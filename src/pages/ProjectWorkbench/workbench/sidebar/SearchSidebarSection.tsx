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
            errorContent={<ErrorRetryView message="无法加载搜索结果。" onRetry={retry} />}
            roots={roots}
            highlightQuery={highlightQuery}
            onOpenHit={openHit}
          />
        </div>
      </div>
    </>
  );
}
