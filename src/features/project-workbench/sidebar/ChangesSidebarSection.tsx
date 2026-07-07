import { useMemo, useState } from "react";

import { SidebarPaneStack } from "#workbench/chrome";

import { ChangesBody } from "../changes/ChangesBody";
import {
  CHANGES_PANEL_DEFAULT_BODY_HEIGHT,
  HISTORY_GRAPH_DEFAULT_BODY_HEIGHT,
} from "../changes/constants";
import { useChangesState } from "../changes/use-changes-state";
import { useWorkbenchEditorActions } from "../editor/use-workbench-editor-actions";
import { CommitGraphBody } from "../history/CommitGraphBody";
import { useCommitGraphState } from "../history/use-commit-graph-state";

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
