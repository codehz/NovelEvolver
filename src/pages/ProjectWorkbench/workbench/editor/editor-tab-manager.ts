import type {
  WorkbenchEditorState,
  WorkbenchEditorTab,
  WorkbenchEditorTarget,
} from "../state/types";

export const emptyWorkbenchEditorState: WorkbenchEditorState = {
  tabs: [],
  activeTabId: null,
  transientTabId: null,
};

export function getWorkbenchEditorTargetKey(target: WorkbenchEditorTarget): string {
  switch (target.kind) {
    case "resource":
      return `resource:${target.resourceId}`;
    case "manuscript":
      return `manuscript:${target.chapterId}`;
    case "timeline-entry":
      return `timeline-entry:${target.entryId}`;
  }
}

export function getWorkbenchEditorTabTargetKey(tab: WorkbenchEditorTab): string {
  switch (tab.kind) {
    case "resource":
      return `resource:${tab.resourceId}`;
    case "manuscript":
      return `manuscript:${tab.chapterId}`;
    case "timeline-comparison":
      return `timeline-entry:${tab.entryId}`;
  }
}

export function findWorkbenchEditorTabByTarget(
  state: WorkbenchEditorState,
  target: WorkbenchEditorTarget,
): WorkbenchEditorTab | undefined {
  const key = getWorkbenchEditorTargetKey(target);
  return state.tabs.find((tab) => getWorkbenchEditorTabTargetKey(tab) === key);
}

function resolveActiveTabId(
  tabs: readonly WorkbenchEditorTab[],
  preferredActiveId: string | null,
): string | null {
  if (tabs.length === 0) {
    return null;
  }
  if (preferredActiveId !== null && tabs.some((tab) => tab.id === preferredActiveId)) {
    return preferredActiveId;
  }
  return tabs[tabs.length - 1]?.id ?? null;
}

export function normalizeWorkbenchEditorState(state: WorkbenchEditorState): WorkbenchEditorState {
  const activeTabId = resolveActiveTabId(state.tabs, state.activeTabId);
  const transientTabId =
    state.transientTabId !== null && state.tabs.some((tab) => tab.id === state.transientTabId)
      ? state.transientTabId
      : null;

  return {
    tabs: [...state.tabs],
    activeTabId,
    transientTabId,
  };
}

export function activateWorkbenchEditorTab(
  state: WorkbenchEditorState,
  tabId: string,
): WorkbenchEditorState {
  return normalizeWorkbenchEditorState({
    ...state,
    activeTabId: tabId,
  });
}

export function clearWorkbenchEditorTabs(): WorkbenchEditorState {
  return emptyWorkbenchEditorState;
}

export function closeWorkbenchEditorTab(
  state: WorkbenchEditorState,
  tabId: string,
): WorkbenchEditorState {
  const tabs = state.tabs.filter((tab) => tab.id !== tabId);
  const activeTabId =
    state.activeTabId === tabId ? (tabs[tabs.length - 1]?.id ?? null) : state.activeTabId;
  const transientTabId = state.transientTabId === tabId ? null : state.transientTabId;

  return normalizeWorkbenchEditorState({
    tabs,
    activeTabId,
    transientTabId,
  });
}

export function pinWorkbenchEditorTab(
  state: WorkbenchEditorState,
  tabId: string,
): WorkbenchEditorState {
  return normalizeWorkbenchEditorState({
    ...state,
    transientTabId: state.transientTabId === tabId ? null : state.transientTabId,
  });
}

export function openWorkbenchEditorTab(
  state: WorkbenchEditorState,
  nextTab: WorkbenchEditorTab,
  intent: "focus" | "open",
): WorkbenchEditorState {
  const nextKey = getWorkbenchEditorTabTargetKey(nextTab);
  const existingIndex = state.tabs.findIndex(
    (tab) => getWorkbenchEditorTabTargetKey(tab) === nextKey,
  );

  if (existingIndex >= 0) {
    const existing = state.tabs[existingIndex]!;
    const tabs = state.tabs.map((tab, index) =>
      index === existingIndex ? { ...nextTab, id: existing.id } : tab,
    );
    return normalizeWorkbenchEditorState({
      tabs,
      activeTabId: existing.id,
      transientTabId:
        intent === "open" && state.transientTabId === existing.id ? null : state.transientTabId,
    });
  }

  if (intent === "focus" && state.transientTabId !== null) {
    const transientIndex = state.tabs.findIndex((tab) => tab.id === state.transientTabId);
    if (transientIndex >= 0) {
      const tabs = state.tabs.map((tab, index) => (index === transientIndex ? nextTab : tab));
      return normalizeWorkbenchEditorState({
        tabs,
        activeTabId: nextTab.id,
        transientTabId: nextTab.id,
      });
    }
  }

  return normalizeWorkbenchEditorState({
    tabs: [...state.tabs, nextTab],
    activeTabId: nextTab.id,
    transientTabId: intent === "focus" ? nextTab.id : state.transientTabId,
  });
}

export function areWorkbenchEditorTabsEqual(
  left: readonly WorkbenchEditorTab[],
  right: readonly WorkbenchEditorTab[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((tab, index) => {
    const candidate = right[index];
    if (candidate === undefined || tab.kind !== candidate.kind) {
      return false;
    }
    if (tab.id !== candidate.id || tab.label !== candidate.label) {
      return false;
    }
    if (tab.kind === "resource") {
      return (
        candidate.kind === "resource" &&
        tab.resourceId === candidate.resourceId &&
        tab.initialContent === candidate.initialContent
      );
    }
    if (tab.kind === "manuscript") {
      return (
        candidate.kind === "manuscript" &&
        tab.chapterId === candidate.chapterId &&
        tab.initialContent === candidate.initialContent
      );
    }
    return (
      candidate.kind === "timeline-comparison" &&
      tab.entryId === candidate.entryId &&
      tab.entryMessage === candidate.entryMessage &&
      tab.entryTimestamp === candidate.entryTimestamp &&
      tab.entryShortHash === candidate.entryShortHash &&
      tab.displayPath === candidate.displayPath &&
      tab.originalContent === candidate.originalContent &&
      tab.currentContent === candidate.currentContent &&
      tab.target.domain === candidate.target.domain &&
      tab.target.entityId === candidate.target.entityId
    );
  });
}

export function areWorkbenchEditorStatesEqual(
  left: WorkbenchEditorState,
  right: WorkbenchEditorState,
): boolean {
  return (
    left.activeTabId === right.activeTabId &&
    left.transientTabId === right.transientTabId &&
    areWorkbenchEditorTabsEqual(left.tabs, right.tabs)
  );
}
