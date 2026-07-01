import { cn } from "#app/lib/cn";

import { EditorBreadcrumb } from "./EditorBreadcrumb";
import { EditorEmptyState } from "./EditorEmptyState";
import { EditorTabPane } from "./EditorTabPane";
import { useWorkbenchEditorActions } from "./use-workbench-editor-actions";

export function EditorArea() {
  const { tabs, activateTab, closeTab } = useWorkbenchEditorActions();

  const activeTab = tabs.find((tab) => tab.active) ?? tabs[0];

  return (
    <section
      aria-label="编辑器"
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-workbench-editor"
    >
      {tabs.length > 0 ? (
        <div
          className="flex h-workbench-tab shrink-0 items-stretch bg-workbench-tab-bar"
          role="tablist"
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "flex max-w-xs cursor-pointer items-center gap-2 px-3 text-sm",
                tab.active
                  ? "bg-workbench-tab-active text-app-foreground"
                  : "bg-workbench-tab-inactive text-ctp-subtext0",
              )}
              role="tab"
              aria-selected={tab.active}
              onClick={() => {
                activateTab(tab.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activateTab(tab.id);
                }
              }}
              tabIndex={0}
            >
              <span aria-hidden="true" className="icon-[codicon--file] text-sm" />
              <span className="truncate">{tab.label}</span>
              <button
                aria-label={`关闭 ${tab.label}`}
                className="ml-1 rounded p-0.5 hover:bg-window-button-hover"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <span aria-hidden="true" className="icon-[codicon--close] text-xs" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab && (
        <div className="flex h-8 shrink-0 items-center gap-1 bg-workbench-editor px-3 text-xs text-ctp-subtext0">
          <EditorBreadcrumb resourcePath={activeTab.resourcePath} />
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {tabs.length === 0 ? (
          <EditorEmptyState />
        ) : (
          tabs.map((tab) => (
            <EditorTabPane
              key={tab.id}
              tabId={tab.id}
              active={tab.active}
              defaultValue={tab.initialContent}
              resourcePath={tab.resourcePath}
            />
          ))
        )}
      </div>
    </section>
  );
}
