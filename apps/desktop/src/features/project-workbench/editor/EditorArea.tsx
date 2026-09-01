import { AutoTransition } from "@codehz/auto-transition";
import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";

import { TabBar } from "#app/features/project-workbench/editor/TabBar";
import { cn } from "#app/shared/lib/ui/cn";

import { editorBreadcrumbRowClass, editorPanelSurfaceClass } from "./editor-chrome";
import { getWorkbenchEditorTabIconClass } from "./editor-contributions";
import { EditorBreadcrumb } from "./EditorBreadcrumb";
import { EditorPaneDeck } from "./EditorPaneDeck";
import { workbenchEditorMolecule } from "./state/molecules";
import { useWorkbenchEditorActions } from "./use-workbench-editor-actions";
import { useWorkbenchEditorTreeSync } from "./use-workbench-editor-tree-sync";

export function EditorArea() {
  useWorkbenchEditorTreeSync();
  const { activeEditorTabAtom, activeTabIdAtom, transientTabIdAtom } =
    useMolecule(workbenchEditorMolecule);
  const activeTab = useAtomValue(activeEditorTabAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const transientTabId = useAtomValue(transientTabIdAtom);
  const { tabs, activateTab, closeTab, pinTab } = useWorkbenchEditorActions();

  return (
    <AutoTransition
      as="section"
      aria-label="编辑器"
      className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col", editorPanelSurfaceClass)}
    >
      <TabBar
        tabs={tabs}
        activeId={activeTabId}
        transientId={transientTabId}
        onActivate={activateTab}
        onClose={closeTab}
        onPin={pinTab}
        renderIcon={(tab) => (
          <span aria-hidden="true" className={getWorkbenchEditorTabIconClass(tab)} />
        )}
      />

      {activeTab && (
        <div className={editorBreadcrumbRowClass}>
          <EditorBreadcrumb tab={activeTab} />
        </div>
      )}

      <EditorPaneDeck tabs={tabs} activeTabId={activeTabId} transientTabId={transientTabId} />
    </AutoTransition>
  );
}
