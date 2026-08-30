import { molecule, use } from "bunshi/react";
import { atom } from "jotai";

import type { WorktreeDomain } from "#domain/worktree";
import { branchNameScope } from "#workbench/session/branch-scope";
import { projectIdScope } from "#workbench/session/project-scope";
import type { TreeDropPreview } from "#workbench/tree/tree-drag";

export type ExplorerDomain = WorktreeDomain;

export type ExplorerCrossDragSource = {
  domain: ExplorerDomain;
  sourceId: string;
  sourceType: string;
};

export type ExplorerCrossDragHover = {
  domain: ExplorerDomain;
  preview: TreeDropPreview;
  targetParentId: string;
  index?: number;
};

export type ExplorerDomainRefs = {
  list: HTMLUListElement | null;
  shell: HTMLDivElement | null;
};

export const explorerCrossDragMolecule = molecule(() => {
  use(projectIdScope);
  use(branchNameScope);

  const sourceAtom = atom<ExplorerCrossDragSource | null>(null);
  const hoverAtom = atom<ExplorerCrossDragHover | null>(null);
  const domainRefs: Record<ExplorerDomain, ExplorerDomainRefs> = {
    manuscript: { list: null, shell: null },
    resource: { list: null, shell: null },
  };

  return {
    sourceAtom,
    hoverAtom,
    domainRefs,
  };
});

const EXPLORER_DOMAIN_SELECTOR = "[data-explorer-domain]";

export function findExplorerDomainAtPoint(clientX: number, clientY: number): ExplorerDomain | null {
  const target = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>(EXPLORER_DOMAIN_SELECTOR);
  if (target === null || target === undefined) {
    return null;
  }
  const domain = target.dataset.explorerDomain;
  if (domain === "manuscript" || domain === "resource") {
    return domain;
  }
  return null;
}

export function isPointInsideElement(
  clientX: number,
  clientY: number,
  element: HTMLElement | null,
): boolean {
  if (element === null) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
}
