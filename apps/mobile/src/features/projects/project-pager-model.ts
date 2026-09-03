export const PROJECT_PAGES = ["Explorer", "Editor", "AI"] as const;

export type ProjectPage = (typeof PROJECT_PAGES)[number];

export const PROJECT_PAGE_INDEX: Record<ProjectPage, number> = {
  Explorer: 0,
  Editor: 1,
  AI: 2,
};

export function projectPageAt(index: number): ProjectPage {
  return PROJECT_PAGES[index] ?? "Explorer";
}

export function preloadProjectPages(page: ProjectPage, loaded: ReadonlySet<ProjectPage>) {
  const next = new Set(loaded);
  const index = PROJECT_PAGE_INDEX[page];
  next.add(page);
  const previous = PROJECT_PAGES[index - 1];
  const following = PROJECT_PAGES[index + 1];
  if (previous !== undefined) next.add(previous);
  if (following !== undefined) next.add(following);
  return next;
}

export function shouldReturnToExplorer(page: ProjectPage, wide: boolean) {
  return !wide && page !== "Explorer";
}
