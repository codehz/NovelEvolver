import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useRef } from "react";

import { notificationApi } from "#app/lib/notifications";

import { useManuscript, useResourceLibrary, useWorktreeTimeline } from "../branch/branch-scopes";
import { useWorktreeTreeSnapshot } from "../branch/use-worktree-tree-snapshot";
import { workbenchEditorMolecule } from "../state/molecules";
import type {
  WorkbenchEditorOpenIntent,
  WorkbenchEditorTab,
  WorkbenchEditorTarget,
} from "../state/types";
import {
  activateWorkbenchEditorTab,
  clearWorkbenchEditorTabs,
  closeWorkbenchEditorTab,
  findWorkbenchEditorTabByTarget,
  openWorkbenchEditorTab,
  pinWorkbenchEditorTab,
} from "./editor-tab-manager";

function workbenchEditorTargetLabel(target: WorkbenchEditorTarget): string {
  switch (target.kind) {
    case "resource":
      return "资源文件";
    case "manuscript":
      return "章节";
    case "timeline-entry":
      return `预览：${target.label}`;
  }
}

export function useWorkbenchEditorActions() {
  const { editorStateAtom, tabsAtom } = useMolecule(workbenchEditorMolecule);
  const store = useStore();
  const tabs = useAtomValue(tabsAtom);
  const setEditorState = useSetAtom(editorStateAtom);
  const manuscript = useManuscript();
  const resources = useResourceLibrary();
  const timeline = useWorktreeTimeline();
  const snapshot = useWorktreeTreeSnapshot();
  const focusRequestIdRef = useRef(0);

  const resolveTargetTab = useCallback(
    async (target: WorkbenchEditorTarget): Promise<WorkbenchEditorTab> => {
      switch (target.kind) {
        case "resource": {
          const node = snapshot?.resources.nodes[target.resourceId];
          const label = node?.type === "file" ? node.name : workbenchEditorTargetLabel(target);
          const content = await Promise.resolve(resources.readFile(target.resourceId));
          return {
            id: `resource:${target.resourceId}`,
            kind: "resource",
            resourceId: target.resourceId,
            label,
            initialContent: content,
          };
        }
        case "manuscript": {
          const node = snapshot?.manuscript.nodes[target.chapterId];
          const label = node?.type === "chapter" ? node.title : workbenchEditorTargetLabel(target);
          const content = await Promise.resolve(manuscript.readChapter(target.chapterId));
          return {
            id: `manuscript:${target.chapterId}`,
            kind: "manuscript",
            chapterId: target.chapterId,
            label,
            initialContent: content,
          };
        }
        case "timeline-entry": {
          const currentContent = (
            target.sourceTarget.domain === "manuscript"
              ? Promise.resolve(manuscript.readChapter(target.sourceTarget.entityId))
              : Promise.resolve(resources.readFile(target.sourceTarget.entityId))
          ).catch((error: unknown) => {
            if (target.entryKind === "delete") {
              return "";
            }
            throw error;
          });
          const [historyContent, current] = await Promise.all([
            Promise.resolve(timeline.readTimelineEntryContent(target.entryId)),
            currentContent,
          ]);
          if (historyContent.content === null) {
            throw new Error("此记录没有可预览内容。");
          }
          return {
            id: `timeline-entry:${target.entryId}`,
            kind: "timeline-comparison",
            label: workbenchEditorTargetLabel(target),
            target: target.sourceTarget,
            entryId: target.entryId,
            entryMessage: target.message,
            entryTimestamp: target.timestamp,
            entryShortHash: target.shortHash,
            displayPath: target.displayPath,
            originalContent: historyContent.content,
            currentContent: current,
          };
        }
      }
    },
    [manuscript, resources, snapshot, timeline],
  );

  const openEditorTarget = useCallback(
    async (target: WorkbenchEditorTarget, intent: WorkbenchEditorOpenIntent) => {
      const currentState = store.get(editorStateAtom);
      const existing = findWorkbenchEditorTabByTarget(currentState, target);
      if (existing !== undefined) {
        setEditorState((state) => openWorkbenchEditorTab(state, existing, intent));
        return;
      }

      const requestId =
        intent === "focus" ? (focusRequestIdRef.current += 1) : focusRequestIdRef.current;

      try {
        const tab = await resolveTargetTab(target);
        if (intent === "focus" && requestId !== focusRequestIdRef.current) {
          return;
        }
        setEditorState((state) => openWorkbenchEditorTab(state, tab, intent));
      } catch (error) {
        notificationApi.error(
          error instanceof Error ? error.message : `无法打开${workbenchEditorTargetLabel(target)}`,
          {
            source:
              target.kind === "resource"
                ? "资源库"
                : target.kind === "manuscript"
                  ? "正文"
                  : "时间线",
          },
        );
      }
    },
    [editorStateAtom, resolveTargetTab, setEditorState, store],
  );

  const focusTarget = useCallback(
    (target: WorkbenchEditorTarget) => {
      void openEditorTarget(target, "focus");
    },
    [openEditorTarget],
  );

  const openTarget = useCallback(
    (target: WorkbenchEditorTarget) => {
      void openEditorTarget(target, "open");
    },
    [openEditorTarget],
  );

  const activateTab = useCallback(
    (tabId: string) => {
      setEditorState((state) => activateWorkbenchEditorTab(state, tabId));
    },
    [setEditorState],
  );

  const clearAllTabs = useCallback(() => {
    setEditorState(clearWorkbenchEditorTabs());
  }, [setEditorState]);

  const closeTab = useCallback(
    (tabId: string) => {
      setEditorState((state) => closeWorkbenchEditorTab(state, tabId));
    },
    [setEditorState],
  );

  const pinTab = useCallback(
    (tabId: string) => {
      setEditorState((state) => pinWorkbenchEditorTab(state, tabId));
    },
    [setEditorState],
  );

  return {
    tabs,
    activateTab,
    clearAllTabs,
    closeTab,
    focusTarget,
    openTarget,
    pinTab,
  };
}
