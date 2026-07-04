import type { VirtualWorktree } from "nano-git/worktree/core";

export const MANUSCRIPT_DIR = "manuscript";
export const MANUSCRIPT_BODIES_DIR = `${MANUSCRIPT_DIR}/bodies`;
export const MANUSCRIPT_OUTLINE_PATH = `${MANUSCRIPT_DIR}/outline.json`;

export function chapterBodyPath(id: string): string {
  assertValidManuscriptId(id);
  return `${MANUSCRIPT_BODIES_DIR}/${id}.md`;
}

export function assertValidManuscriptId(id: string): void {
  if (!/^[\w-]{10}$/.test(id)) {
    throw new Error(`Invalid manuscript node id: ${id}`);
  }
}

export function ensureManuscriptStorage(worktree: VirtualWorktree): void {
  ensureDirectory(worktree, MANUSCRIPT_DIR);
  ensureDirectory(worktree, MANUSCRIPT_BODIES_DIR);
}

function ensureDirectory(worktree: VirtualWorktree, path: string): void {
  const stat = worktree.stat(path);
  if (stat === null) {
    worktree.mkdir(path, { recursive: true });
    return;
  }
  if (stat.kind !== "tree") {
    throw new Error(`Manuscript storage path is not a folder: ${path}`);
  }
}
