import type { HybridObject } from "react-native-nitro-modules";

/**
 * Project `.npk` files live under `{filesDir,Documents}/novelevolver/projects`.
 * JS only ever sees filenames — native code owns the absolute path.
 */
export interface NativeFs extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  listNpkFiles(): string[];
  fileExists(fileName: string): boolean;
  deleteFile(fileName: string): void;
  renameFile(fromFileName: string, toFileName: string): void;
  shareFile(fileName: string): void;
  notifyChanged(): void;
}
