import { EditorEmptyState } from "./EditorEmptyState";
import { EditorTabPane } from "./EditorTabPane";
import type { WorkbenchEditorTab } from "./state/types";
import { useWorkbenchEditorDocumentRuntime } from "./use-workbench-editor-document-runtime";

type EditorPaneDeckProps = {
  tabs: WorkbenchEditorTab[];
  activeTabId: string | null;
  transientTabId: string | null;
};

export function EditorPaneDeck({ tabs, activeTabId, transientTabId }: EditorPaneDeckProps) {
  const documentRuntime = useWorkbenchEditorDocumentRuntime();

  return (
    <div key={+(tabs.length === 0)} className="flex min-h-0 min-w-0 flex-1 flex-col">
      {tabs.length === 0 ? (
        <EditorEmptyState />
      ) : (
        tabs.map((tab) => (
          <EditorTabPane
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            transient={tab.id === transientTabId}
            documentRuntime={documentRuntime}
          />
        ))
      )}
    </div>
  );
}
