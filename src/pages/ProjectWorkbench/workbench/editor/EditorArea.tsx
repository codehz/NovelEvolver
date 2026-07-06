import { AutoTransition } from "@codehz/auto-transition";
import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";
import { useRef } from "react";

import type { PlainTextEditorHandle } from "#app/components/PlainTextEditor";
import { TabBar } from "#app/components/TabBar";

import { workbenchEditorMolecule } from "../state/molecules";
import { contentEditorTabIconClass } from "../tree/content-tree-icons";
import { EditorBreadcrumb } from "./EditorBreadcrumb";
import { EditorEmptyState } from "./EditorEmptyState";
import { EditorTabPane } from "./EditorTabPane";
import { useWorkbenchEditorActions } from "./use-workbench-editor-actions";
import { useWorkbenchEditorScmSync } from "./use-workbench-editor-scm-sync";
import { useWorkbenchEditorTreeSync } from "./use-workbench-editor-tree-sync";

export function EditorArea() {
  const editorHandlesRef = useRef(new Map<string, PlainTextEditorHandle>());
  useWorkbenchEditorTreeSync();
  useWorkbenchEditorScmSync(editorHandlesRef);
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
              editorRef={(handle) => {
                if (tab.kind === "timeline-comparison") {
                  return;
                }
                if (handle === null) {
                  editorHandlesRef.current.delete(tab.id);
                  return;
                }
                editorHandlesRef.current.set(tab.id, handle);
              }}
            />
          ))
        )}
      </div>
    </AutoTransition>
  );
}
