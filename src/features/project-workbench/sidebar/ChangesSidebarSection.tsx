import { useMemo, useState } from "react";

import type { Change, CommitSummary } from "#shared/rpc/worktree/index";
import { ChangesBody } from "#workbench/changes/ChangesBody";
import {
  CHANGES_PANEL_DEFAULT_BODY_HEIGHT,
  HISTORY_GRAPH_DEFAULT_BODY_HEIGHT,
} from "#workbench/changes/constants";
import { useChangesState } from "#workbench/changes/use-changes-state";
import { SidebarPaneStack } from "#workbench/chrome";
import { useWorkbenchEditorActions } from "#workbench/editor/use-workbench-editor-actions";
import { CommitGraphBody } from "#workbench/history/CommitGraphBody";
import { useCommitChangesState } from "#workbench/history/use-commit-changes-state";
import { useCommitGraphState } from "#workbench/history/use-commit-graph-state";

export function ChangesSidebarSection() {
  const {
    commit,
    commitMessage,
    committing,
    commitsRefreshKey,
    error,
    loading,
    result,
    retry,
    revertChange,
    setCommitMessage,
  } = useChangesState();
  const graph = useCommitGraphState(commitsRefreshKey);
  const commitChanges = useCommitChangesState(commitsRefreshKey);
  const { focusTarget } = useWorkbenchEditorActions();
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [graphExpanded, setGraphExpanded] = useState(true);

  const panes = useMemo(
    () => [
      {
        id: "changes",
        title: "更改",
        ariaLabel: "更改",
        panelId: "changes-panel",
        expanded: changesExpanded,
        defaultBodyHeight: CHANGES_PANEL_DEFAULT_BODY_HEIGHT,
        body: (
          <ChangesBody
            commitMessage={commitMessage}
            committing={committing}
            error={error}
            loading={loading}
            result={result}
            onCommit={commit}
            onCommitMessageChange={setCommitMessage}
            onOpenChange={(change) =>
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
              })
            }
            onRetry={retry}
            onRevert={revertChange}
          />
        ),
        onToggleExpanded: () => setChangesExpanded((value) => !value),
      },
      {
        id: "graph",
        title: "历史",
        ariaLabel: "历史",
        panelId: "history-graph-panel",
        expanded: graphExpanded,
        defaultBodyHeight: HISTORY_GRAPH_DEFAULT_BODY_HEIGHT,
        body: (
          <CommitGraphBody
            commits={graph.commits}
            error={graph.error}
            loading={graph.loading}
            onRetry={graph.retry}
            expandedHashes={commitChanges.expandedHashes}
            cache={commitChanges.cache}
            onToggleCommit={commitChanges.toggleExpanded}
            onRetryCommit={commitChanges.retry}
            onOpenChange={(commitSummary: CommitSummary, change: Change) =>
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
              })
            }
          />
        ),
        onToggleExpanded: () => setGraphExpanded((value) => !value),
      },
    ],
    [
      changesExpanded,
      commit,
      commitMessage,
      committing,
      commitChanges.cache,
      commitChanges.expandedHashes,
      commitChanges.retry,
      commitChanges.toggleExpanded,
      error,
      graph.commits,
      graph.error,
      graph.loading,
      graph.retry,
      graphExpanded,
      loading,
      focusTarget,
      result,
      retry,
      revertChange,
      setCommitMessage,
    ],
  );

  return <SidebarPaneStack panes={panes} />;
}
