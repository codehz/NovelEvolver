export function isMissingComparisonTargetError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.startsWith("Manuscript node does not exist:") ||
    error.message.startsWith("Manuscript chapter is missing:") ||
    error.message.startsWith("Resource node does not exist:") ||
    error.message.startsWith("Resource file is missing:")
  );
}

export function isNoChangeTextDiffError(error: unknown): boolean {
  return error instanceof Error && error.message === "此节点当前没有可预览的文本差异。";
}
