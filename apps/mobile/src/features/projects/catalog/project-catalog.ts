import { createSettingsId } from "../../../shared/settings/create-id";
import { readJson, settingsKv, writeJson } from "../../../shared/settings/kv";
import {
  parseProjectCatalog,
  sortProjectCatalog,
  type MobileProjectRecord,
} from "./project-catalog-model";

const CATALOG_KEY = "projects.catalog.v1";

export type { MobileProjectRecord } from "./project-catalog-model";

export function readProjectCatalogFrom(kv: typeof settingsKv): MobileProjectRecord[] {
  return parseProjectCatalog(readJson(kv, CATALOG_KEY));
}

export function readProjectCatalog(): MobileProjectRecord[] {
  return readProjectCatalogFrom(settingsKv);
}

export function writeProjectCatalogFrom(
  kv: typeof settingsKv,
  records: MobileProjectRecord[],
): void {
  writeJson(kv, CATALOG_KEY, sortProjectCatalog(records));
}

export function writeProjectCatalog(records: MobileProjectRecord[]): void {
  writeProjectCatalogFrom(settingsKv, records);
}

export function findProjectBySourceUri(uri: string): MobileProjectRecord | null {
  return readProjectCatalog().find((record) => record.sourceUri === uri) ?? null;
}

export function createProjectRecord(
  displayName: string,
  sourceUri: string | null,
  now = Date.now(),
): MobileProjectRecord {
  const id = createSettingsId();
  return {
    id,
    displayName,
    sourceUri,
    repositoryFileName: "repository.npk",
    worktreeFileName: "worktree.sqlite",
    lastOpenedAt: now,
  };
}

export function upsertProjectRecord(record: MobileProjectRecord): MobileProjectRecord[] {
  const records = readProjectCatalog().filter((item) => item.id !== record.id);
  records.push(record);
  writeProjectCatalog(records);
  return records;
}

export function removeProjectRecord(id: string): MobileProjectRecord[] {
  const records = readProjectCatalog().filter((record) => record.id !== id);
  writeProjectCatalog(records);
  return records;
}
