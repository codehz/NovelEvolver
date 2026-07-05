import { ScmDiffError } from "../scm/ScmDiffStatusViews";
import { SearchQueryChrome } from "./SearchQueryChrome";
import { SearchResultTree } from "./SearchResultTree";
import { useWorktreeSearchState } from "./use-worktree-search-state";

export function SearchSidebarSection() {
  const { query, setQuery, error, statsLine, roots, retry, openHit } = useWorktreeSearchState();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SearchQueryChrome query={query} statsLine={statsLine} onQueryChange={setQuery} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {error ? (
          <ScmDiffError onRetry={retry} />
        ) : (
          <SearchResultTree roots={roots} onOpenHit={openHit} />
        )}
      </div>
    </div>
  );
}
