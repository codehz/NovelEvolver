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
  importNpkFile(): Promise<string>;
  shareFile(fileName: string): void;
  notifyChanged(): void;
  /** Opens the system document picker and returns UTF-8 text. Empty string means cancelled. */
  pickUtf8File(): Promise<string>;
  /** Writes `content` to a cache file named `fileName` and opens the share sheet. */
  shareUtf8File(fileName: string, content: string): void;
}
