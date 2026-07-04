export type ResourceWorkbenchEditorTab = {
  id: string;
  kind: "resource";
  resourcePath: string;
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

export function resourceTabLabel(resourcePath: string): string {
  const slash = resourcePath.lastIndexOf("/");
  return slash === -1 ? resourcePath : resourcePath.slice(slash + 1);
}
