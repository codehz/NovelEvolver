import { AutoTransition } from "@codehz/auto-transition";
import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";

import { TabBar } from "#app/components/TabBar";

import { workbenchEditorMolecule } from "../state/molecules";
import { contentEditorTabIconClass } from "../tree/content-tree-icons";
import { EditorBreadcrumb } from "./EditorBreadcrumb";
import { EditorPaneDeck } from "./EditorPaneDeck";
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
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-app-background"
    >
      <TabBar
        tabs={tabs}
        activeId={activeTabId}
        transientId={transientTabId}
        onActivate={activateTab}
        onClose={closeTab}
        onPin={pinTab}
        renderIcon={(tab) => (
          <span aria-hidden="true" className={contentEditorTabIconClass(tab.kind)} />
        )}
      />

      {activeTab && (
        <div className="flex h-8 shrink-0 items-center gap-1 bg-app-background px-3 text-xs text-ctp-subtext0">
          <EditorBreadcrumb tab={activeTab} />
        </div>
      )}

      <EditorPaneDeck tabs={tabs} activeTabId={activeTabId} transientTabId={transientTabId} />
    </AutoTransition>
  );
}
