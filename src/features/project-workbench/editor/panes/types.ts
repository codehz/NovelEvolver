import type { ComponentType } from "react";

import type { WorkbenchEditorTab } from "../state/types";
import type { WorkbenchEditorDocumentRuntime } from "../use-workbench-editor-document-runtime";

export type WorkbenchEditorPaneProps = {
  tab: WorkbenchEditorTab;
  active: boolean;
  transient: boolean;
  documentRuntime: WorkbenchEditorDocumentRuntime;
};

export type WorkbenchEditorPaneContribution = {
  tabKind: WorkbenchEditorTab["kind"];
  Pane: ComponentType<WorkbenchEditorPaneProps>;
};
