import { homedir } from "node:os";

import { shortenHomePath } from "@shared/path-display";
import type { ProjectMetadata } from "@shared/project";
import { app } from "electron";

let cachedHomeDir: string | null = null;

/** Electron `app.getPath("home")` when ready; falls back to `os.homedir()`. */
export function getHomeDirForDisplay(): string {
  if (cachedHomeDir !== null) {
    return cachedHomeDir;
  }

  try {
    cachedHomeDir = app.getPath("home");
  } catch {
    cachedHomeDir = homedir();
  }

  return cachedHomeDir;
}

export function toProjectMetadata(record: Omit<ProjectMetadata, "displayPath">): ProjectMetadata {
  return {
    ...record,
    displayPath: shortenHomePath(record.path, getHomeDirForDisplay()),
  };
}
