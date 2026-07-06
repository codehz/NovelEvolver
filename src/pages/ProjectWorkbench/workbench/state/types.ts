import type { TimelineEntryKind, TimelineTarget } from "#shared/rpc/worktree-timeline-rpc";

export type ResourceWorkbenchEditorTab = {
  id: string;
  kind: "resource";
  resourceId: string;
  label: string;
  initialContent: string;
};

export type ManuscriptWorkbenchEditorTab = {
  id: string;
  kind: "manuscript";
  chapterId: string;
  label: string;
  initialContent: string;
};

export type TimelineComparisonWorkbenchEditorTab = {
  id: string;
  kind: "timeline-comparison";
  label: string;
  target: TimelineTarget;
  entryId: string;
  entryMessage: string;
  entryTimestamp: number;
  entryShortHash?: string;
  displayPath: string;
  originalContent: string;
  currentContent: string;
};

export type ContentWorkbenchEditorTab = ResourceWorkbenchEditorTab | ManuscriptWorkbenchEditorTab;

export type WorkbenchEditorTab = ContentWorkbenchEditorTab | TimelineComparisonWorkbenchEditorTab;

export type WorkbenchEditorOpenIntent = "focus" | "open";

export type WorkbenchEditorTarget =
  | {
      kind: "resource";
      resourceId: string;
    }
  | {
      kind: "manuscript";
      chapterId: string;
    }
  | {
      kind: "timeline-entry";
      entryId: string;
      sourceTarget: TimelineTarget;
      entryKind: TimelineEntryKind;
      label: string;
      message: string;
      timestamp: number;
      shortHash?: string;
      displayPath: string;
    };

export type WorkbenchEditorState = {
  tabs: WorkbenchEditorTab[];
  activeTabId: string | null;
  transientTabId: string | null;
};
