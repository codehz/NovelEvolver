import { ScmDiffError } from "../scm/ScmDiffStatusViews";
import { SearchQueryChrome } from "../search/SearchQueryChrome";
import { SearchResultTree } from "../search/SearchResultTree";
import { useWorktreeSearchState } from "../search/use-worktree-search-state";

export function SearchSidebarSection() {
  const { query, setQuery, highlightQuery, error, statsLine, roots, retry, openHit } =
    useWorktreeSearchState();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SearchQueryChrome query={query} statsLine={statsLine} onQueryChange={setQuery} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {error ? (
          <ScmDiffError onRetry={retry} />
        ) : (
          <SearchResultTree roots={roots} highlightQuery={highlightQuery} onOpenHit={openHit} />
        )}
      </div>
    </div>
  );
}
