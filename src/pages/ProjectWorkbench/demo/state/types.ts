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

export type WorkbenchEditorTab = ResourceWorkbenchEditorTab | ManuscriptWorkbenchEditorTab;
