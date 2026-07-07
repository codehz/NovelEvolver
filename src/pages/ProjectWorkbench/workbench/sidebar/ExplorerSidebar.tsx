import { useMemo, useState } from "react";

import { SidebarPaneStack } from "#app/components/workbench";

import { ManuscriptSectionBody } from "../explorer/manuscript/ManuscriptSection";
import { ResourceLibrarySectionBody } from "../explorer/resource-library/ResourceLibrarySection";
import { TimelineSectionBody } from "../explorer/timeline/TimelineSection";

const DEFAULT_MANUSCRIPT_BODY_HEIGHT = 168;
const DEFAULT_REFERENCE_BODY_HEIGHT = 148;
const DEFAULT_TIMELINE_BODY_HEIGHT = 116;

export function ExplorerSidebar({ projectLabel }: { projectLabel: string }) {
  const [manuscriptExpanded, setManuscriptExpanded] = useState(true);
  const [referenceExpanded, setReferenceExpanded] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(true);

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
        id: "timeline",
        title: "时间线",
        ariaLabel: "时间线",
        panelId: "explorer-timeline-panel",
        expanded: timelineExpanded,
        defaultBodyHeight: DEFAULT_TIMELINE_BODY_HEIGHT,
        body: <TimelineSectionBody />,
        onToggleExpanded: () => setTimelineExpanded((value) => !value),
      },
    ],
    [manuscriptExpanded, projectLabel, referenceExpanded, timelineExpanded],
  );

  return <SidebarPaneStack panes={panes} />;
}
