import type { ReactNode } from "react";

import type { ChangesSnapshot } from "#shared/rpc/worktree/index";
import type { Change } from "#shared/rpc/worktree/index";
import { ErrorRetryView, SidebarHeaderActionButton, SidebarHeaderActions } from "#workbench/chrome";

import { ChangesCommitForm } from "./ChangesCommitForm";
import { ChangesList } from "./ChangesList";
import { ChangesEmptyState, ChangesLoading, ChangesWarningBanner } from "./ChangesStatusViews";

function resolveChangesPanelContent({
  loading,
  error,
  result,
  onRetry,
  onRevert,
  onOpenChange,
}: {
  loading: boolean;
  error: boolean;
  result: ChangesSnapshot | null;
  onRetry: () => void;
  onRevert: (changeId: string) => void;
  onOpenChange: (change: Change) => void;
}): ReactNode {
  if (loading) {
    return <ChangesLoading />;
  }
  if (error) {
    return <ErrorRetryView message="无法加载差异信息。" onRetry={onRetry} />;
  }
  if (result === null) {
    return <ChangesEmptyState />;
  }
  if (!result.hasChanges) {
    return (
      <>
        {result.warning ? (
          <ChangesWarningBanner message={result.warning} className="px-2 pt-2" />
        ) : null}
        <ChangesEmptyState />
      </>
    );
  }

  return (
    <>
      {result.warning ? (
        <ChangesWarningBanner message={result.warning} className="mx-2 mb-1" />
      ) : null}
      <ChangesList
        manuscriptChanges={result.manuscriptChanges}
        resourceChanges={result.resourceChanges}
        onRevert={onRevert}
        onOpenChange={onOpenChange}
      />
    </>
  );
}

type ChangesBodyProps = {
  canRevertAll: boolean;
  commitMessage: string;
  committing: boolean;
  loading: boolean;
  error: boolean;
  result: ChangesSnapshot | null;
  onCommitMessageChange: (value: string) => void;
  onCommit: () => void;
  onRetry: () => void;
  onRevert: (changeId: string) => void;
  onRevertAll: () => void;
  onOpenChange: (change: Change) => void;
};

export function ChangesBody({
  canRevertAll,
  commitMessage,
  committing,
  loading,
  error,
  result,
  onCommitMessageChange,
  onCommit,
  onRetry,
  onRevert,
  onRevertAll,
  onOpenChange,
}: ChangesBodyProps) {
  return (
    <div className="flex min-h-0 flex-col">
      <SidebarHeaderActions>
        <SidebarHeaderActionButton
          label="还原所有更改"
          icon="icon-[codicon--discard]"
          disabled={!canRevertAll}
          onClick={onRevertAll}
        />
      </SidebarHeaderActions>
      <ChangesCommitForm
        commitMessage={commitMessage}
        committing={committing}
        onCommit={onCommit}
        onCommitMessageChange={onCommitMessageChange}
      />
      {resolveChangesPanelContent({ loading, error, result, onRetry, onRevert, onOpenChange })}
    </div>
  );
}
