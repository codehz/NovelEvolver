import type { TimelineTarget } from "#shared/rpc/worktree-timeline-rpc";

export type ResourceWorkbenchEditorTab = {
  id: string;
  kind: "resource";
  resourceId: string;
  label: string;
  active: boolean;
  initialContent: string;
};

export type ManuscriptWorkbenchEditorTab = {
  id: string;
  kind: "manuscript";
  chapterId: string;
  label: string;
  active: boolean;
  initialContent: string;
};

export type TimelinePreviewWorkbenchEditorTab = {
  id: string;
  kind: "timeline-preview";
  label: string;
  active: boolean;
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

export type WorkbenchEditorTab = ContentWorkbenchEditorTab | TimelinePreviewWorkbenchEditorTab;
