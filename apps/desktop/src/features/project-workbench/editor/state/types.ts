import type { HistoryEntryKind, HistoryTarget } from "#domain/worktree";
import type { ChangeDomain, ChangeKind } from "#domain/worktree";

import type { EditorSelectionSnapshot } from "./editor-caret";

export type ResourceWorkbenchEditorTab = {
  id: string;
  kind: "resource";
  resourceId: string;
  label: string;
};

export type ManuscriptWorkbenchEditorTab = {
  id: string;
  kind: "manuscript";
  chapterId: string;
  label: string;
};

export type ComparisonWorkbenchEditorTab = {
  id: string;
  kind: "comparison";
  label: string;
  canEditCurrent: boolean;
  target:
    | {
        kind: "history-entry";
        sourceTarget: HistoryTarget;
        entryId: string;
        entryMessage: string;
        entryTimestamp: number;
        entryShortHash?: string;
      }
    | {
        kind: "change";
        sourceTarget: {
          domain: ChangeDomain;
          entityId: string;
        };
        changeId: string;
        changeKind: ChangeKind;
      }
    | {
        kind: "commit-change";
        commitHash: string;
        shortHash?: string;
        sourceTarget: {
          domain: ChangeDomain;
          entityId: string;
        };
        changeId: string;
        changeKind: ChangeKind;
      };
  displayPath: string;
  originalContent: string;
  currentContent: string;
};

export type ContentWorkbenchEditorTab = ResourceWorkbenchEditorTab | ManuscriptWorkbenchEditorTab;

export type WorkbenchEditorTab = ContentWorkbenchEditorTab | ComparisonWorkbenchEditorTab;

export type ResourceWorkbenchEditorDocument = {
  key: string;
  kind: "resource";
  resourceId: string;
  baselineContent: string;
};

export type ManuscriptWorkbenchEditorDocument = {
  key: string;
  kind: "manuscript";
  chapterId: string;
  baselineContent: string;
};

export type WorkbenchEditorDocument =
  | ResourceWorkbenchEditorDocument
  | ManuscriptWorkbenchEditorDocument;

export type WorkbenchEditorDocuments = Record<string, WorkbenchEditorDocument>;

export type WorkbenchEditorOpenIntent = "focus" | "open";

export type WorkbenchEditorNavigationRequest = {
  kind: "text-range";
  targetKey: string;
  selection: EditorSelectionSnapshot;
};

export type WorkbenchEditorNavigationRequestResult = "done" | "retry" | "skip";

export type WorkbenchEditorOpenOptions = {
  navigation?: Omit<WorkbenchEditorNavigationRequest, "targetKey">;
};

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
      kind: "history-entry";
      entryId: string;
      sourceTarget: HistoryTarget;
      entryKind: HistoryEntryKind;
      label: string;
      message: string;
      timestamp: number;
      shortHash?: string;
      displayPath: string;
    }
  | {
      kind: "change";
      changeId: string;
      sourceTarget: {
        domain: ChangeDomain;
        entityId: string;
      };
      changeKind: ChangeKind;
      label: string;
      displayPath: string;
    }
  | {
      kind: "commit-change";
      commitHash: string;
      shortHash?: string;
      changeId: string;
      sourceTarget: {
        domain: ChangeDomain;
        entityId: string;
      };
      changeKind: ChangeKind;
      label: string;
      displayPath: string;
    };

export type WorkbenchEditorState = {
  tabs: WorkbenchEditorTab[];
  documents: WorkbenchEditorDocuments;
  activeTabId: string | null;
  transientTabId: string | null;
};
