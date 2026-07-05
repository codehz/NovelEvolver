import type { ReactNode } from "react";

import type { ScmSnapshot } from "#shared/rpc/worktree-scm";

import { ScmChangesList } from "./ScmChangesList";
import { ScmCommitForm } from "./ScmCommitForm";
import {
  ScmDiffEmptyState,
  ScmDiffError,
  ScmDiffLoading,
  ScmWarningBanner,
} from "./ScmDiffStatusViews";

function resolveChangesPanelContent({
  loading,
  error,
  result,
  onRetry,
  onRevert,
}: {
  loading: boolean;
  error: boolean;
  result: ScmSnapshot | null;
  onRetry: () => void;
  onRevert: (changeId: string) => void;
}): ReactNode {
  if (loading) {
    return <ScmDiffLoading />;
  }
  if (error) {
    return <ScmDiffError onRetry={onRetry} />;
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
}: {
  commitMessage: string;
  committing: boolean;
  loading: boolean;
  error: boolean;
  result: ScmSnapshot | null;
  onCommitMessageChange: (value: string) => void;
  onCommit: () => void;
  onRetry: () => void;
  onRevert: (changeId: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <ScmCommitForm
        commitMessage={commitMessage}
        committing={committing}
        onCommit={onCommit}
        onCommitMessageChange={onCommitMessageChange}
      />
      {resolveChangesPanelContent({ loading, error, result, onRetry, onRevert })}
    </div>
  );
}
