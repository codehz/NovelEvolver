import type { ReactNode } from "react";

import { ErrorRetryView } from "#app/components/workbench";
import type { ChangesSnapshot } from "#shared/rpc/worktree-changes-rpc";
import type { Change } from "#shared/rpc/worktree-changes-rpc";

import { ScmChangesList } from "./ScmChangesList";
import { ScmCommitForm } from "./ScmCommitForm";
import { ScmDiffEmptyState, ScmDiffLoading, ScmWarningBanner } from "./ScmDiffStatusViews";

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
    return <ScmDiffLoading />;
  }
  if (error) {
    return <ErrorRetryView message="无法加载差异信息。" onRetry={onRetry} />;
  }
  if (result === null) {
    return <ScmDiffEmptyState />;
  }
  if (!result.hasChanges) {
    return (
      <>
        {result.warning ? (
          <ScmWarningBanner message={result.warning} className="px-2 pt-2" />
        ) : null}
        <ScmDiffEmptyState />
      </>
    );
  }

  return (
    <>
      {result.warning ? <ScmWarningBanner message={result.warning} className="mx-2 mb-1" /> : null}
      <ScmChangesList
        manuscriptChanges={result.manuscriptChanges}
        resourceChanges={result.resourceChanges}
        onRevert={onRevert}
        onOpenChange={onOpenChange}
      />
    </>
  );
}

export function ScmChangesBody({
  commitMessage,
  committing,
  loading,
  error,
  result,
  onCommitMessageChange,
  onCommit,
  onRetry,
  onRevert,
  onOpenChange,
}: {
  commitMessage: string;
  committing: boolean;
  loading: boolean;
  error: boolean;
  result: ChangesSnapshot | null;
  onCommitMessageChange: (value: string) => void;
  onCommit: () => void;
  onRetry: () => void;
  onRevert: (changeId: string) => void;
  onOpenChange: (change: Change) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <ScmCommitForm
        commitMessage={commitMessage}
        committing={committing}
        onCommit={onCommit}
        onCommitMessageChange={onCommitMessageChange}
      />
      {resolveChangesPanelContent({ loading, error, result, onRetry, onRevert, onOpenChange })}
    </div>
  );
}
