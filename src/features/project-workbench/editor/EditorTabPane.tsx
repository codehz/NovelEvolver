import { ScopeProvider } from "bunshi/react";

import { editorTabScope } from "../state/molecules";
import type { WorkbenchEditorTab } from "../state/types";
import { getWorkbenchEditorPane } from "./editor-pane-registry";
import type { WorkbenchEditorDocumentRuntime } from "./use-workbench-editor-document-runtime";

type EditorTabPaneProps = {
  tab: WorkbenchEditorTab;
  active: boolean;
  transient: boolean;
  documentRuntime: WorkbenchEditorDocumentRuntime;
};

export function EditorTabPane({ tab, active, transient, documentRuntime }: EditorTabPaneProps) {
  const Pane = getWorkbenchEditorPane(tab);

  return (
    <ScopeProvider scope={editorTabScope} value={tab.id}>
      <div
        className={active ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}
        aria-hidden={!active}
      >
        <Pane tab={tab} active={active} transient={transient} documentRuntime={documentRuntime} />
      </div>
    </ScopeProvider>
  );
}
