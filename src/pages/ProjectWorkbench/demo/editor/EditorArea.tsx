import { AutoTransition } from "@codehz/auto-transition";

import { TabBar, type TabItem } from "#app/components/TabBar";

import { EditorBreadcrumb } from "./EditorBreadcrumb";
import { EditorEmptyState } from "./EditorEmptyState";
import { EditorTabPane } from "./EditorTabPane";
import { useWorkbenchEditorActions } from "./use-workbench-editor-actions";

export function EditorArea() {
  const { tabs, activateTab, closeTab } = useWorkbenchEditorActions();

  const activeTab = tabs.find((tab) => tab.active) ?? tabs[0];

  return (
    <AutoTransition
      as="section"
      aria-label="编辑器"
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-workbench-editor"
    >
      <TabBar tabs={tabs as TabItem[]} onActivate={activateTab} onClose={closeTab} />

      {activeTab && (
        <div className="flex h-8 shrink-0 items-center gap-1 bg-workbench-editor px-3 text-xs text-ctp-subtext0">
          <EditorBreadcrumb tab={activeTab} />
        </div>
      )}

      <div key={+(tabs.length === 0)} className="flex min-h-0 min-w-0 flex-1 flex-col">
        {tabs.length === 0 ? (
          <EditorEmptyState />
        ) : (
          tabs.map((tab) => (
            <EditorTabPane
              key={tab.id}
              tabId={tab.id}
              active={tab.active}
              defaultValue={tab.initialContent}
              resourcePath={tab.kind === "resource" ? tab.resourcePath : undefined}
              chapterId={tab.kind === "manuscript" ? tab.chapterId : undefined}
            />
          ))
        )}
      </div>
    </AutoTransition>
  );
}
