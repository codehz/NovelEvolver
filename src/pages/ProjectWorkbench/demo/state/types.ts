export type WorkbenchEditorTab = {
  id: string;
  kind: "resource";
  resourcePath: string;
  label: string;
  active: boolean;
  initialContent: string;
};

export function resourceTabId(resourcePath: string): string {
  return `resource:${resourcePath}`;
}

export function resourceTabLabel(resourcePath: string): string {
  const slash = resourcePath.lastIndexOf("/");
  return slash === -1 ? resourcePath : resourcePath.slice(slash + 1);
}
