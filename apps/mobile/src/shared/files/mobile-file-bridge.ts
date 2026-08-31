import { keepLocalCopy, pick, types } from "@react-native-documents/picker";
import { Dirs, FileSystem } from "react-native-file-access";
import Share from "react-native-share";

export type PickedDocument = {
  uri: string;
  fileName: string;
};

export const appFiles = {
  root: `${Dirs.DocumentDir}/novelevolver`,
  cache: `${Dirs.CacheDir}/novelevolver`,
};

function pathFromUri(uri: string): string {
  return uri.startsWith("file://") ? uri.slice("file://".length) : uri;
}

export async function ensureDirectory(path: string): Promise<void> {
  if (!(await FileSystem.exists(path))) {
    await FileSystem.mkdir(path);
  }
}

export async function removePath(path: string): Promise<void> {
  if (await FileSystem.exists(path)) {
    await FileSystem.unlink(path);
  }
}

export async function copyPath(source: string, destination: string): Promise<void> {
  await ensureDirectory(destination.slice(0, destination.lastIndexOf("/")));
  await FileSystem.cp(pathFromUri(source), destination);
}

export async function pickNpkDocument(): Promise<PickedDocument | null> {
  try {
    const [picked] = await pick({
      mode: "open",
      type: [types.allFiles],
      allowMultiSelection: false,
    });
    if (picked === undefined) return null;
    const fileName = picked.name ?? "project.npk";
    if (!fileName.toLowerCase().endsWith(".npk")) {
      throw new Error("请选择 .npk 项目文件");
    }
    return { uri: picked.uri, fileName };
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("cancel")) {
      return null;
    }
    throw error;
  }
}

export async function copyPickedDocument(
  document: PickedDocument,
  destination: string,
): Promise<string> {
  await ensureDirectory(appFiles.cache);
  const [copy] = await keepLocalCopy({
    files: [{ uri: document.uri, fileName: document.fileName }],
    destination: "cachesDirectory",
  });
  if (copy === undefined || copy.status !== "success") {
    throw new Error("无法复制所选项目文件到应用沙盒");
  }
  await copyPath(copy.localUri, destination);
  return destination;
}

export async function shareNpk(path: string, fileName: string): Promise<void> {
  await Share.open({
    url: path.startsWith("file://") ? path : `file://${path}`,
    type: "application/octet-stream",
    filename: fileName,
    failOnCancel: false,
  });
}
