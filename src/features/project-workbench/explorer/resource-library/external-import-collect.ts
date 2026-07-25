import type {
  ResourceImportEntry,
  ResourceImportSkip,
  ResourceImportSkipReason,
} from "#shared/rpc/worktree/index";
import { RESOURCE_IMPORT_MAX_FILE_BYTES } from "#shared/rpc/worktree/index";

export type ExternalImportCollectResult = {
  entries: ResourceImportEntry[];
  skipped: ResourceImportSkip[];
};

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
};

type FileSystemFileEntryLike = FileSystemEntryLike & {
  file: (
    successCallback: (file: File) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void;
};

type FileSystemDirectoryReaderLike = {
  readEntries: (
    successCallback: (entries: FileSystemEntryLike[]) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void;
};

type FileSystemDirectoryEntryLike = FileSystemEntryLike & {
  createReader: () => FileSystemDirectoryReaderLike;
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntryLike | null;
};

function skip(
  relativePath: string,
  reason: ResourceImportSkipReason,
  message?: string,
): ResourceImportSkip {
  return { relativePath, reason, message };
}

function decodeUtf8Text(bytes: ArrayBuffer): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

async function readAllDirectoryEntries(
  directory: FileSystemDirectoryEntryLike,
): Promise<FileSystemEntryLike[]> {
  const reader = directory.createReader();
  const all: FileSystemEntryLike[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (batch.length === 0) {
      break;
    }
    all.push(...batch);
  }
  return all;
}

async function collectFromFile(
  file: File,
  relativePath: string,
  result: ExternalImportCollectResult,
): Promise<void> {
  if (file.size >= RESOURCE_IMPORT_MAX_FILE_BYTES) {
    result.skipped.push(
      skip(relativePath, "too-large", `文件超过 ${RESOURCE_IMPORT_MAX_FILE_BYTES} 字节`),
    );
    return;
  }
  try {
    const bytes = await file.arrayBuffer();
    const content = decodeUtf8Text(bytes);
    if (content === null) {
      result.skipped.push(skip(relativePath, "invalid-utf8", "不是有效的 UTF-8 文本"));
      return;
    }
    result.entries.push({ kind: "file", relativePath, content });
  } catch {
    result.skipped.push(skip(relativePath, "unreadable", "无法读取文件"));
  }
}

async function collectFromEntry(
  entry: FileSystemEntryLike,
  relativePath: string,
  result: ExternalImportCollectResult,
): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntryLike;
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(resolve, reject);
    }).catch(() => null);
    if (file === null) {
      result.skipped.push(skip(relativePath, "unreadable", "无法读取文件"));
      return;
    }
    await collectFromFile(file, relativePath, result);
    return;
  }

  if (!entry.isDirectory) {
    result.skipped.push(skip(relativePath, "unreadable", "无法识别的条目类型"));
    return;
  }

  result.entries.push({ kind: "folder", relativePath });
  const directory = entry as FileSystemDirectoryEntryLike;
  let children: FileSystemEntryLike[];
  try {
    children = await readAllDirectoryEntries(directory);
  } catch {
    result.skipped.push(skip(relativePath, "unreadable", "无法读取目录"));
    return;
  }

  for (const child of children) {
    const childPath = relativePath === "" ? child.name : `${relativePath}/${child.name}`;
    await collectFromEntry(child, childPath, result);
  }
}

function hasFilesType(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes("Files");
}

/**
 * Walk OS drag payloads into resource-library import entries.
 * Prefers `webkitGetAsEntry` (directory-aware); falls back to flat `files`.
 */
export async function collectExternalImportEntries(
  dataTransfer: DataTransfer,
): Promise<ExternalImportCollectResult> {
  const result: ExternalImportCollectResult = { entries: [], skipped: [] };
  if (!hasFilesType(dataTransfer)) {
    return result;
  }

  const items = Array.from(dataTransfer.items ?? []);
  const entryItems: FileSystemEntryLike[] = [];
  for (const item of items) {
    const withEntry = item as DataTransferItemWithEntry;
    const entry = withEntry.webkitGetAsEntry?.() ?? null;
    if (entry !== null) {
      entryItems.push(entry as FileSystemEntryLike);
    }
  }

  if (entryItems.length > 0) {
    for (const entry of entryItems) {
      await collectFromEntry(entry, entry.name, result);
    }
    return result;
  }

  for (const file of Array.from(dataTransfer.files)) {
    await collectFromFile(file, file.name, result);
  }
  return result;
}

export function dataTransferHasFiles(dataTransfer: DataTransfer | null): boolean {
  if (dataTransfer === null) {
    return false;
  }
  return hasFilesType(dataTransfer);
}
