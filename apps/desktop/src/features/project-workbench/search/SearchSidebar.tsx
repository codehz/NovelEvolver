import { useState } from "react";

import {
  SidebarHeaderActions,
  SidebarHeaderActionButton,
  ErrorRetryView,
} from "#app/features/project-workbench/chrome";
import { SearchQueryBar } from "#app/features/project-workbench/search/SearchQueryBar";
import { SearchResultTree } from "#app/features/project-workbench/search/SearchResultTree";
import { useWorktreeSearchState } from "#app/features/project-workbench/search/use-worktree-search-state";

export function SearchSidebar() {
  const {
    query,
    setQuery,
    replaceText,
    setReplaceText,
    isRegex,
    toggleRegex,
    showReplacePreview,
    status,
    statsLine,
    roots,
    retry,
    canRefresh,
    openHit,
    replaceBusy,
    replaceAll,
    replaceInFile,
    replaceOccurrence,
    canReplace,
  } = useWorktreeSearchState();
  const [replaceExpanded, setReplaceExpanded] = useState(false);

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
      <div className="flex h-0 min-h-0 flex-1 flex-col">
        <SearchQueryBar
          query={query}
          replaceText={replaceText}
          isRegex={isRegex}
          statsLine={statsLine}
          replaceExpanded={replaceExpanded}
          replaceBusy={replaceBusy}
          canReplaceAll={canReplace}
          onQueryChange={setQuery}
          onReplaceTextChange={setReplaceText}
          onReplaceExpandedChange={setReplaceExpanded}
          onToggleRegex={toggleRegex}
          onReplaceAll={replaceAll}
        />
        <div className="h-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <SearchResultTree
            status={status}
            errorContent={<ErrorRetryView message="无法加载搜索结果。" onRetry={retry} />}
            roots={roots}
            replacePreviewText={replaceText}
            showReplacePreview={showReplacePreview}
            showReplaceActions={replaceExpanded}
            replaceEnabled={canReplace}
            onOpenHit={openHit}
            onReplaceInFile={replaceInFile}
            onReplaceOccurrence={replaceOccurrence}
          />
        </div>
      </div>
    </>
  );
}
