import { useMolecule } from "bunshi/react";
import type { RpcPromise } from "capnweb";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { RefObject } from "react";
import { useEffect } from "react";

import type { PlainTextEditorHandle } from "#app/components/PlainTextEditor";
import type { ManuscriptHandle } from "#shared/rpc/manuscript-rpc";
import type { ResourceLibraryHandle } from "#shared/rpc/resource-library-rpc";

import { useManuscript, useResourceLibrary } from "../branch/branch-scopes";
import { useWorktreeScmRevision } from "../branch/use-worktree-scm-revision";
import { workbenchEditorMolecule } from "../state/molecules";
import { type WorkbenchEditorTab } from "../state/types";
import { areWorkbenchEditorTabsEqual, normalizeWorkbenchEditorTabs } from "./editor-tab-state";

async function syncManuscriptTab(
  tab: Extract<WorkbenchEditorTab, { kind: "manuscript" }>,
  manuscript: RpcPromise<ManuscriptHandle>,
  editorHandle: PlainTextEditorHandle | undefined,
): Promise<WorkbenchEditorTab | null> {
  const content = await Promise.resolve(manuscript.readChapter(tab.chapterId));
  if (editorHandle?.getValue() !== content) {
    editorHandle?.setValue(content);
  }
  return {
    ...tab,
    initialContent: content,
  };
}

async function syncResourceTab(
  tab: Extract<WorkbenchEditorTab, { kind: "resource" }>,
  resources: RpcPromise<ResourceLibraryHandle>,
  editorHandle: PlainTextEditorHandle | undefined,
): Promise<WorkbenchEditorTab | null> {
  const content = await Promise.resolve(resources.readFile(tab.resourceId));
  if (editorHandle?.getValue() !== content) {
    editorHandle?.setValue(content);
  }
  return {
    ...tab,
    initialContent: content,
  };
}

export function useWorkbenchEditorScmSync(
  editorHandlesRef: RefObject<Map<string, PlainTextEditorHandle>>,
): void {
  const revision = useWorktreeScmRevision();
  const manuscript = useManuscript();
  const resources = useResourceLibrary();
  const { tabsAtom, activeTabIdAtom } = useMolecule(workbenchEditorMolecule);
  const [tabs, setTabs] = useAtom(tabsAtom);
  const activeTabId = useAtomValue(activeTabIdAtom);
  const setActiveTabId = useSetAtom(activeTabIdAtom);

  useEffect(() => {
    let cancelled = false;

    if (tabs.length === 0) {
      return;
    }

    void Promise.all(
      tabs.map((tab) => {
        const editorHandle = editorHandlesRef.current.get(tab.id);
        if (tab.kind === "manuscript") {
          return syncManuscriptTab(tab, manuscript, editorHandle).catch(() => tab);
        }
        return syncResourceTab(tab, resources, editorHandle).catch(() => tab);
      }),
    )
      .then((nextTabs) => {
        if (cancelled) {
          return;
        }

        const { tabs: normalizedTabs, activeId } = normalizeWorkbenchEditorTabs(
          nextTabs.filter((tab): tab is WorkbenchEditorTab => tab !== null),
          activeTabId,
        );
        if (areWorkbenchEditorTabsEqual(tabs, normalizedTabs)) {
          return;
        }

        setActiveTabId(activeId);
        setTabs(normalizedTabs);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    activeTabId,
    editorHandlesRef,
    manuscript,
    resources,
    revision,
    setActiveTabId,
    setTabs,
    tabs,
  ]);
}
