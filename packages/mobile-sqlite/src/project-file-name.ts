function isReservedFileChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return code < 32 || '\\/:*?"<>|'.includes(char);
}

export function toProjectFileName(displayName: string): string {
  const stem = displayName
    .trim()
    .replace(/\.npk$/i, "")
    .replace(/./gu, (char) => (isReservedFileChar(char) ? "_" : char))
    .replace(/_+/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();
  if (stem === "" || stem === "." || stem === "..") {
    throw new Error("项目名称不能为空");
  }
  const fileName = `${stem}.npk`;
  if (fileName.length > 255) {
    throw new Error("项目名称过长");
  }
  return fileName;
}

export function displayNameFromFile(fileName: string): string {
  return fileName.replace(/\.npk$/i, "") || "未命名项目";
}
