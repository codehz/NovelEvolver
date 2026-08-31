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
