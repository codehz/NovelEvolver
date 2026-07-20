import { useState } from "react";

import type { Change, CommitSummary } from "#shared/rpc/worktree/index";
import { useCreateBranchFromCommit } from "#workbench/branch/use-create-branch-from-commit";
import { ChangesBody } from "#workbench/changes/ChangesBody";
import {
  CHANGES_PANEL_DEFAULT_BODY_HEIGHT,
  HISTORY_DEFAULT_BODY_HEIGHT,
} from "#workbench/changes/constants";
import { useChangesState } from "#workbench/changes/use-changes-state";
import { SidebarPaneStack } from "#workbench/chrome";
import { useWorkbenchEditorActions } from "#workbench/editor/use-workbench-editor-actions";
import { HistoryBody } from "#workbench/history/HistoryBody";
import { useCommitChangesState } from "#workbench/history/use-commit-changes-state";
import { useCommitHistoryState } from "#workbench/history/use-commit-history-state";

export function ChangesSidebar() {
  const {
    canRevertAll,
    commit,
    commitMessage,
    committing,
    commitsRefreshKey,
    error,
    invalidateCommits,
    loading,
    result,
    retry,
    revertAll,
    revertChange,
    setCommitMessage,
  } = useChangesState();
  // commitsRefreshKey couples working-tree commits with history refresh.
  const history = useCommitHistoryState(commitsRefreshKey);
  const commitChanges = useCommitChangesState(commitsRefreshKey);
  const { focusTarget } = useWorkbenchEditorActions();
  const createBranchFromCommit = useCreateBranchFromCommit();
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);

  const openWorkingTreeChange = (change: Change) => {
    focusTarget({
      kind: "change",
      changeId: change.id,
      sourceTarget: {
        domain: change.domain,
        entityId: change.entityId,
      },
      changeKind: change.kind,
      label: change.label,
      displayPath: change.displayPath,
    });
  };

  const openCommitChange = (commitSummary: CommitSummary, change: Change) => {
    focusTarget({
      kind: "commit-change",
      commitHash: commitSummary.hash,
      shortHash: commitSummary.shortHash,
      changeId: change.id,
      sourceTarget: {
        domain: change.domain,
        entityId: change.entityId,
      },
      changeKind: change.kind,
      label: change.label,
      displayPath: change.displayPath,
    });
  };

  return (
    <SidebarPaneStack
      panes={[
        {
          id: "changes",
          title: "更改",
          ariaLabel: "更改",
          panelId: "changes-panel",
          expanded: changesExpanded,
          defaultBodyHeight: CHANGES_PANEL_DEFAULT_BODY_HEIGHT,
          body: (
            <ChangesBody
              canRevertAll={canRevertAll}
              commitMessage={commitMessage}
              committing={committing}
              error={error}
              loading={loading}
              result={result}
              onCommit={commit}
              onCommitMessageChange={setCommitMessage}
              onOpenChange={openWorkingTreeChange}
              onRetry={retry}
              onRevert={revertChange}
              onRevertAll={() => {
                void revertAll();
              }}
            />
          ),
          onToggleExpanded: () => setChangesExpanded((value) => !value),
        },
        {
          id: "history",
          title: "历史",
          ariaLabel: "历史",
          panelId: "history-panel",
          expanded: historyExpanded,
          defaultBodyHeight: HISTORY_DEFAULT_BODY_HEIGHT,
          body: (
            <HistoryBody
              commits={history.commits}
              error={history.error}
              loading={history.loading}
              onRetry={history.retry}
              expandedHashes={commitChanges.expandedHashes}
              cache={commitChanges.cache}
              onToggleCommit={commitChanges.toggleExpanded}
              onRetryCommit={commitChanges.retry}
              onOpenChange={openCommitChange}
              onCreateBranchFromCommit={(commitSummary) => {
                void createBranchFromCommit(commitSummary);
              }}
              onHistoryMutated={invalidateCommits}
            />
          ),
          onToggleExpanded: () => setHistoryExpanded((value) => !value),
        },
      ]}
    />
  );
}
