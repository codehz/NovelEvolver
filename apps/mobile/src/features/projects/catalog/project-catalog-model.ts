export type MobileProjectRecord = {
  id: string;
  displayName: string;
  sourceUri: string | null;
  repositoryFileName: string;
  worktreeFileName: string;
  lastOpenedAt: number;
};

export function isMobileProjectRecord(value: unknown): value is MobileProjectRecord {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.displayName === "string" &&
    (record.sourceUri === null || typeof record.sourceUri === "string") &&
    typeof record.repositoryFileName === "string" &&
    typeof record.worktreeFileName === "string" &&
    typeof record.lastOpenedAt === "number"
  );
}

export function parseProjectCatalog(value: unknown): MobileProjectRecord[] {
  return sortProjectCatalog(Array.isArray(value) ? value.filter(isMobileProjectRecord) : []);
}

export function sortProjectCatalog(records: MobileProjectRecord[]): MobileProjectRecord[] {
  return [...records].sort((left, right) => right.lastOpenedAt - left.lastOpenedAt);
}
