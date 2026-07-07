import { useMemo, useState } from "react";

import { SidebarPaneStack } from "#workbench/chrome";

import { ManuscriptSectionBody } from "../explorer/manuscript/ManuscriptSection";
import { ResourceLibrarySectionBody } from "../explorer/resource-library/ResourceLibrarySection";
import { FileHistorySectionBody } from "../history/FileHistorySection";

const DEFAULT_MANUSCRIPT_BODY_HEIGHT = 168;
const DEFAULT_REFERENCE_BODY_HEIGHT = 148;
const DEFAULT_HISTORY_BODY_HEIGHT = 116;

export function ExplorerSidebar({ projectLabel }: { projectLabel: string }) {
  const [manuscriptExpanded, setManuscriptExpanded] = useState(true);
  const [referenceExpanded, setReferenceExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);

  const panes = useMemo(
    () => [
      {
        id: "manuscript",
        title: projectLabel,
        ariaLabel: projectLabel,
        panelId: "explorer-manuscript-panel",
        expanded: manuscriptExpanded,
        defaultBodyHeight: DEFAULT_MANUSCRIPT_BODY_HEIGHT,
        body: <ManuscriptSectionBody />,
        onToggleExpanded: () => setManuscriptExpanded((value) => !value),
      },
      {
        id: "reference",
        title: "资源库",
        ariaLabel: "资源库",
        panelId: "explorer-reference-panel",
        expanded: referenceExpanded,
        defaultBodyHeight: DEFAULT_REFERENCE_BODY_HEIGHT,
        body: <ResourceLibrarySectionBody />,
        onToggleExpanded: () => setReferenceExpanded((value) => !value),
      },
      {
        id: "history",
        title: "历史",
        ariaLabel: "历史",
        panelId: "explorer-history-panel",
        expanded: historyExpanded,
        defaultBodyHeight: DEFAULT_HISTORY_BODY_HEIGHT,
        body: <FileHistorySectionBody />,
        onToggleExpanded: () => setHistoryExpanded((value) => !value),
      },
    ],
    [historyExpanded, manuscriptExpanded, projectLabel, referenceExpanded],
  );

  return <SidebarPaneStack panes={panes} />;
}
