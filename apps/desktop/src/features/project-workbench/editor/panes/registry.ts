import type { ComponentType } from "react";

import type { WorkbenchEditorTab } from "../state/types";
import { ComparisonEditorPane } from "./ComparisonEditorPane";
import { TextDocumentEditorPane } from "./TextDocumentEditorPane";
import type { WorkbenchEditorPaneContribution, WorkbenchEditorPaneProps } from "./types";

const workbenchEditorPaneContributions: readonly WorkbenchEditorPaneContribution[] = [
  {
    tabKind: "resource",
    Pane: TextDocumentEditorPane as ComponentType<WorkbenchEditorPaneProps>,
  },
  {
    tabKind: "manuscript",
    Pane: TextDocumentEditorPane as ComponentType<WorkbenchEditorPaneProps>,
  },
  {
    tabKind: "comparison",
    Pane: ComparisonEditorPane as ComponentType<WorkbenchEditorPaneProps>,
  },
] as const;

export function getWorkbenchEditorPane(
  tab: WorkbenchEditorTab,
): ComponentType<WorkbenchEditorPaneProps> {
  const contribution = workbenchEditorPaneContributions.find(
    (candidate) => candidate.tabKind === tab.kind,
  );
  if (contribution === undefined) {
    throw new Error(`Unsupported workbench editor tab kind: ${tab.kind}`);
  }
  return contribution.Pane as ComponentType<WorkbenchEditorPaneProps>;
}
