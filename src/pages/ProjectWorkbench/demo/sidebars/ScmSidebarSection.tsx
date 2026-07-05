import { useMemo, useState } from "react";

import { SCM_CHANGES_DEFAULT_BODY_HEIGHT, SCM_GRAPH_DEFAULT_BODY_HEIGHT } from "../scm/constants";
import { ScmChangesBody } from "../scm/ScmChangesBody";
import { ScmGraphPlaceholder } from "../scm/ScmGraphPlaceholder";
import { ScmSidebarPaneStack } from "../scm/ScmSidebarPaneStack";
import { useScmChangesState } from "../scm/use-scm-changes-state";

export function ScmSidebarSection() {
  const {
    commit,
    commitMessage,
    committing,
    error,
    loading,
    result,
    retry,
    revertChange,
    setCommitMessage,
  } = useScmChangesState();
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
        body: <ScmGraphPlaceholder />,
        onToggleExpanded: () => setGraphExpanded((value) => !value),
      },
    ],
    [
      changesExpanded,
      commit,
      commitMessage,
      committing,
      error,
      graphExpanded,
      loading,
      result,
      retry,
      revertChange,
      setCommitMessage,
    ],
  );

  return <ScmSidebarPaneStack panes={panes} />;
}
