import { NitroModules } from "react-native-nitro-modules";

import type { NativeFs } from "./NativeFs.nitro";

/** SQLite `location` for project `.npk` files (relative to the platform base directory). */
export const PROJECTS_LOCATION = "novelevolver/projects";

export { displayNameFromFile, toProjectFileName } from "./project-file-name";

let nativeFs: NativeFs | undefined;

function getNativeFs(): NativeFs {
  nativeFs ??= NitroModules.createHybridObject<NativeFs>("NativeFs");
  return nativeFs;
}

export function listProjectFiles(): string[] {
  return getNativeFs().listNpkFiles();
}

export function projectFileExists(fileName: string): boolean {
  return getNativeFs().fileExists(fileName);
}

export function deleteProjectFile(fileName: string): void {
  getNativeFs().deleteFile(fileName);
}

export function renameProjectFile(fromFileName: string, toFileName: string): void {
  if (fromFileName === toFileName) {
    return;
  }
  getNativeFs().renameFile(fromFileName, toFileName);
}

/** Opens the platform file picker and copies the selected `.npk` into project storage. */
export async function importProjectFile(): Promise<string | null> {
  const fileName = await getNativeFs().importNpkFile();
  return fileName === "" ? null : fileName;
}

export function shareProjectFile(fileName: string): void {
  getNativeFs().shareFile(fileName);
}

export function notifyProjectFilesChanged(): void {
  getNativeFs().notifyChanged();
}
