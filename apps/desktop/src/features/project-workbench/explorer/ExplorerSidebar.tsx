import { useState } from "react";

import { SidebarPaneStack } from "#workbench/chrome";
import {
  DEFAULT_HISTORY_BODY_HEIGHT,
  DEFAULT_MANUSCRIPT_BODY_HEIGHT,
  DEFAULT_REFERENCE_BODY_HEIGHT,
} from "#workbench/explorer/constants";
import { ManuscriptSectionBody } from "#workbench/explorer/manuscript/ManuscriptSection";
import { ResourceLibrarySectionBody } from "#workbench/explorer/resource-library/ResourceLibrarySection";
import { FileHistorySectionBody } from "#workbench/history/FileHistorySection";

type ExplorerSidebarProps = {
  projectLabel: string;
};

export function ExplorerSidebar({ projectLabel }: ExplorerSidebarProps) {
  const [manuscriptExpanded, setManuscriptExpanded] = useState(true);
  const [referenceExpanded, setReferenceExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);

  return (
    <SidebarPaneStack
      panes={[
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
      ]}
    />
  );
}
