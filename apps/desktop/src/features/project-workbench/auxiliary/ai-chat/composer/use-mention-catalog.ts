import type { ManuscriptTreeSnapshot, ResourceTreeSnapshot } from "@novelevolver/domain/worktree";
import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";
import { useMemo } from "react";

import { getManuscriptNodePath } from "#app/features/project-workbench/explorer/manuscript/manuscript-tree";
import { manuscriptTreeMolecule } from "#app/features/project-workbench/explorer/manuscript/state/manuscript-tree-molecule";
import { getResourceNodePath } from "#app/features/project-workbench/explorer/resource-library/resource-tree";
import { resourceLibraryTreeMolecule } from "#app/features/project-workbench/explorer/resource-library/state/resource-tree-molecule";

import { kindLabelFor, type MentionCatalogItem } from "./mention-query";

function enumerateManuscriptItems(snapshot: ManuscriptTreeSnapshot | null): MentionCatalogItem[] {
  if (snapshot === null) {
    return [];
  }
  const items: MentionCatalogItem[] = [];
  for (const node of Object.values(snapshot.nodes)) {
    if (node.id === snapshot.rootId) {
      continue;
    }
    const displayPath = getManuscriptNodePath(snapshot, node.id);
    const label = node.title;
    items.push({
      domain: "manuscript",
      id: node.id,
      kind: node.type,
      label,
      displayPath,
      rowLabel: `@${label}`,
      detail: displayPath,
      kindLabel: kindLabelFor(node.type, "manuscript"),
    });
  }
  return items;
}

function enumerateResourceItems(snapshot: ResourceTreeSnapshot | null): MentionCatalogItem[] {
  if (snapshot === null) {
    return [];
  }
  const items: MentionCatalogItem[] = [];
  for (const node of Object.values(snapshot.nodes)) {
    if (node.id === snapshot.rootId) {
      continue;
    }
    const displayPath = getResourceNodePath(snapshot, node.id);
    const label = node.name;
    items.push({
      domain: "resource",
      id: node.id,
      kind: node.type,
      label,
      displayPath,
      rowLabel: `@${label}`,
      detail: displayPath,
      kindLabel: kindLabelFor(node.type, "resource"),
    });
  }
  return items;
}

/**
 * Project tree nodes available for `@` mention completion.
 * Sourced from explorer tree snapshots (client-side; no extra RPC).
 */
export function useMentionCatalog(): {
  items: readonly MentionCatalogItem[];
  loading: boolean;
} {
  const { treeAtom: manuscriptTreeAtom } = useMolecule(manuscriptTreeMolecule);
  const { treeAtom: resourceTreeAtom } = useMolecule(resourceLibraryTreeMolecule);
  const manuscriptState = useAtomValue(manuscriptTreeAtom);
  const resourceState = useAtomValue(resourceTreeAtom);

  const items = useMemo(() => {
    return [
      ...enumerateManuscriptItems(manuscriptState.snapshot),
      ...enumerateResourceItems(resourceState.snapshot),
    ];
  }, [manuscriptState.snapshot, resourceState.snapshot]);

  const loading = manuscriptState.snapshot === null && resourceState.snapshot === null;

  return { items, loading };
}
