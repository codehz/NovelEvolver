import type { WorkbenchEditorTab } from "../state/types";

export function resolveWorkbenchEditorActiveId(
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

export function withWorkbenchEditorActiveFlags(
  tabs: readonly WorkbenchEditorTab[],
  activeId: string | null,
): WorkbenchEditorTab[] {
  return tabs.map((tab) => ({
    ...tab,
    active: tab.id === activeId,
  }));
}

export function normalizeWorkbenchEditorTabs(
  tabs: readonly WorkbenchEditorTab[],
  preferredActiveId: string | null,
): { tabs: WorkbenchEditorTab[]; activeId: string | null } {
  const activeId = resolveWorkbenchEditorActiveId(tabs, preferredActiveId);
  return {
    activeId,
    tabs: withWorkbenchEditorActiveFlags(tabs, activeId),
  };
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
    if (
      tab.id !== candidate.id ||
      tab.label !== candidate.label ||
      tab.active !== candidate.active ||
      tab.initialContent !== candidate.initialContent
    ) {
      return false;
    }
    if (tab.kind === "resource") {
      return candidate.kind === "resource" && tab.resourceId === candidate.resourceId;
    }
    return candidate.kind === "manuscript" && tab.chapterId === candidate.chapterId;
  });
}
