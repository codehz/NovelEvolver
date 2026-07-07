import { useMemo, useState } from "react";

import { SidebarPaneStack } from "#app/components/workbench";

import { useWorkbenchEditorActions } from "../editor/use-workbench-editor-actions";
import { SCM_CHANGES_DEFAULT_BODY_HEIGHT, SCM_GRAPH_DEFAULT_BODY_HEIGHT } from "../scm/constants";
import { ScmChangesBody } from "../scm/ScmChangesBody";
import { ScmGraphBody } from "../scm/ScmGraphBody";
import { useScmChangesState } from "../scm/use-scm-changes-state";
import { useScmGraphState } from "../scm/use-scm-graph-state";

export function ScmSidebarSection() {
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
  } = useScmChangesState();
  const graph = useScmGraphState(commitsRefreshKey);
  const { focusTarget } = useWorkbenchEditorActions();
  const [changesExpanded, setChangesExpanded] = useState(true);
  const [graphExpanded, setGraphExpanded] = useState(true);

  const panes = useMemo(
    () => [
      {
        id: "changes",
        title: "更改",
        ariaLabel: "更改",
        panelId: "scm-changes-panel",
        expanded: changesExpanded,
        defaultBodyHeight: SCM_CHANGES_DEFAULT_BODY_HEIGHT,
        body: (
          <ScmChangesBody
            commitMessage={commitMessage}
            committing={committing}
            error={error}
            loading={loading}
            result={result}
            onCommit={commit}
            onCommitMessageChange={setCommitMessage}
            onOpenChange={(change) =>
              focusTarget({
                kind: "scm-change",
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
        title: "图表",
        ariaLabel: "图表",
        panelId: "scm-graph-panel",
        expanded: graphExpanded,
        defaultBodyHeight: SCM_GRAPH_DEFAULT_BODY_HEIGHT,
        body: (
          <ScmGraphBody
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
