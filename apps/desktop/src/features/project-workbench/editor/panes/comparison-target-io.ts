import type { HistoryTarget } from "#domain/worktree";
import { isMissingComparisonTargetError } from "#workbench/lib/comparison-errors";
import { useManuscript, useResourceLibrary } from "#workbench/session/workspace-handles";

export function readComparisonTargetCurrentContent(
  target: HistoryTarget,
  manuscript: ReturnType<typeof useManuscript>,
  resources: ReturnType<typeof useResourceLibrary>,
): Promise<string | null> {
  const read =
    target.domain === "manuscript"
      ? Promise.resolve(manuscript.readChapter(target.entityId))
      : Promise.resolve(resources.readFile(target.entityId));
  return read.catch((error: unknown) => {
    if (isMissingComparisonTargetError(error)) {
      return null;
    }
    throw error;
  });
}

export function writeComparisonTargetCurrentContent(
  target: HistoryTarget,
  content: string,
  manuscript: ReturnType<typeof useManuscript>,
  resources: ReturnType<typeof useResourceLibrary>,
): Promise<void> {
  if (target.domain === "manuscript") {
    return Promise.resolve(manuscript.writeChapter(target.entityId, content));
  }
  return Promise.resolve(resources.writeFile(target.entityId, content));
}
