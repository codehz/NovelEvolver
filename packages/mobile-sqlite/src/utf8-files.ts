import { getNativeFs } from "./native-fs";

/** Opens the system document picker and returns UTF-8 text, or `null` if cancelled. */
export async function pickUtf8File(): Promise<string | null> {
  const text = await getNativeFs().pickUtf8File();
  return text === "" ? null : text;
}

/** Shares UTF-8 `content` as a file named `fileName` (native owns the temp path). */
export function shareUtf8File(fileName: string, content: string): void {
  getNativeFs().shareUtf8File(fileName, content);
}
