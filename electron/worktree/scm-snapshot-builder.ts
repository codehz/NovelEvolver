import type { ScmChange, ScmSnapshot } from "#shared/rpc/worktree-scm-rpc";

import { computeStats } from "./diff-utils";
import { computeMinimalReorderedManuscriptIds } from "./manuscript-reorder";
import type { ManuscriptEntry, ManuscriptSnapshotState } from "./snapshot-state";

export type ResourceSnapshotEntry = {
  id: string;
  type: "file" | "folder";
  name: string;
  parentId: string;
  index: number;
  depth: number;
  displayPath: string;
  order: number;
  content: string;
};

export type ResourceSnapshotState = {
  entries: Map<string, ResourceSnapshotEntry>;
};

type BuildDetailedScmSnapshotOptions = {
  revision: number;
  baseTree: string;
  warning: string | null;
  baseManuscript: ManuscriptSnapshotState;
  currentManuscript: ManuscriptSnapshotState;
  baseResources: ResourceSnapshotState;
  currentResources: ResourceSnapshotState;
};

export function buildDetailedScmSnapshot(options: BuildDetailedScmSnapshotOptions): ScmSnapshot {
  const {
    revision,
    baseTree,
    warning,
    baseManuscript,
    currentManuscript,
    baseResources,
    currentResources,
  } = options;

  const manuscriptChanges: Array<{ change: ScmChange; order: number }> = [];
  const resourceChanges: Array<{ change: ScmChange; order: number }> = [];
  const reorderedManuscriptIds = computeMinimalReorderedManuscriptIds(
    baseManuscript,
    currentManuscript,
  );

  const manuscriptIds = new Set<string>([
    ...baseManuscript.entries.keys(),
    ...currentManuscript.entries.keys(),
  ]);
  for (const id of manuscriptIds) {
    const previous = baseManuscript.entries.get(id) ?? null;
    const current = currentManuscript.entries.get(id) ?? null;
    collectManuscriptChanges(
      manuscriptChanges,
      id,
      previous,
      current,
      reorderedManuscriptIds.has(id),
    );
  }

  const resourceIds = new Set<string>([
    ...baseResources.entries.keys(),
    ...currentResources.entries.keys(),
  ]);
  for (const id of resourceIds) {
    const previous = baseResources.entries.get(id) ?? null;
    const current = currentResources.entries.get(id) ?? null;
    collectResourceChanges(resourceChanges, id, previous, current);
  }

  manuscriptChanges.sort(
    (left, right) =>
      left.order - right.order || left.change.displayPath.localeCompare(right.change.displayPath),
  );
  resourceChanges.sort(
    (left, right) =>
      left.order - right.order || left.change.displayPath.localeCompare(right.change.displayPath),
  );

  return {
    revision,
    baseTree,
    hasChanges: manuscriptChanges.length > 0 || resourceChanges.length > 0,
    warning,
    manuscriptChanges: manuscriptChanges.map((item) => item.change),
    resourceChanges: resourceChanges.map((item) => item.change),
  };
}

function collectManuscriptChanges(
  changes: Array<{ change: ScmChange; order: number }>,
  id: string,
  previous: ManuscriptEntry | null,
  current: ManuscriptEntry | null,
  reordered: boolean,
): void {
  if (previous === null && current !== null) {
    changes.push({
      order: current.order,
      change: {
        id: `manuscript:create:${id}`,
        domain: "manuscript",
        kind: "create",
        entityId: id,
        entityKind: current.type === "chapter" ? "chapter" : "folder",
        label: current.title,
        displayPath: current.displayPath,
        depth: current.depth,
        stats:
          current.type === "chapter" && current.content !== ""
            ? { added: current.content.length, removed: 0 }
            : undefined,
      },
    });
    return;
  }

  if (previous !== null && current === null) {
    changes.push({
      order: previous.order,
      change: {
        id: `manuscript:delete:${id}`,
        domain: "manuscript",
        kind: "delete",
        entityId: id,
        entityKind: previous.type === "chapter" ? "chapter" : "folder",
        label: previous.title,
        displayPath: previous.displayPath,
        depth: previous.depth,
        stats:
          previous.type === "chapter" && previous.content !== ""
            ? { added: 0, removed: previous.content.length }
            : undefined,
      },
    });
    return;
  }

  if (previous === null || current === null) {
    return;
  }

  const entityKind = current.type === "chapter" ? "chapter" : "folder";
  const order = current.order;

  if (previous.title !== current.title) {
    changes.push({
      order,
      change: {
        id: `manuscript:rename:${id}`,
        domain: "manuscript",
        kind: "rename",
        entityId: id,
        entityKind,
        label: current.title,
        previousLabel: previous.title,
        displayPath: current.displayPath,
        depth: current.depth,
      },
    });
  }

  if (previous.parentId !== current.parentId) {
    changes.push({
      order,
      change: {
        id: `manuscript:move:${id}`,
        domain: "manuscript",
        kind: "move",
        entityId: id,
        entityKind,
        label: current.title,
        previousPath: previous.displayPath,
        displayPath: current.displayPath,
        depth: current.depth,
      },
    });
  } else if (reordered) {
    changes.push({
      order,
      change: {
        id: `manuscript:reorder:${id}`,
        domain: "manuscript",
        kind: "reorder",
        entityId: id,
        entityKind,
        label: current.title,
        previousPath: previous.displayPath,
        displayPath: current.displayPath,
        depth: current.depth,
      },
    });
  }

  if (current.type === "chapter" && previous.content !== current.content) {
    changes.push({
      order,
      change: {
        id: `manuscript:content:${id}`,
        domain: "manuscript",
        kind: "content",
        entityId: id,
        entityKind: "chapter",
        label: current.title,
        displayPath: current.displayPath,
        depth: current.depth,
        stats: computeStats(previous.content, current.content),
      },
    });
  }
}

function collectResourceChanges(
  changes: Array<{ change: ScmChange; order: number }>,
  id: string,
  previous: ResourceSnapshotEntry | null,
  current: ResourceSnapshotEntry | null,
): void {
  if (previous === null && current !== null) {
    changes.push({
      order: current.order,
      change: {
        id: `resource:create:${id}`,
        domain: "resource",
        kind: "create",
        entityId: id,
        entityKind: current.type === "file" ? "file" : "folder",
        label: current.name,
        displayPath: current.displayPath,
        depth: current.depth,
        stats:
          current.type === "file" && current.content !== ""
            ? { added: current.content.length, removed: 0 }
            : undefined,
      },
    });
    return;
  }

  if (previous !== null && current === null) {
    changes.push({
      order: previous.order,
      change: {
        id: `resource:delete:${id}`,
        domain: "resource",
        kind: "delete",
        entityId: id,
        entityKind: previous.type === "file" ? "file" : "folder",
        label: previous.name,
        displayPath: previous.displayPath,
        depth: previous.depth,
        stats:
          previous.type === "file" && previous.content !== ""
            ? { added: 0, removed: previous.content.length }
            : undefined,
      },
    });
    return;
  }

  if (previous === null || current === null) {
    return;
  }

  const entityKind = current.type === "file" ? "file" : "folder";
  const order = current.order;

  if (previous.name !== current.name) {
    changes.push({
      order,
      change: {
        id: `resource:rename:${id}`,
        domain: "resource",
        kind: "rename",
        entityId: id,
        entityKind,
        label: current.name,
        previousLabel: previous.name,
        displayPath: current.displayPath,
        depth: current.depth,
      },
    });
  }

  if (previous.parentId !== current.parentId) {
    changes.push({
      order,
      change: {
        id: `resource:move:${id}`,
        domain: "resource",
        kind: "move",
        entityId: id,
        entityKind,
        label: current.name,
        previousPath: previous.displayPath,
        displayPath: current.displayPath,
        depth: current.depth,
      },
    });
  }

  if (current.type === "file" && previous.content !== current.content) {
    changes.push({
      order,
      change: {
        id: `resource:content:${id}`,
        domain: "resource",
        kind: "content",
        entityId: id,
        entityKind: "file",
        label: current.name,
        displayPath: current.displayPath,
        depth: current.depth,
        stats: computeStats(previous.content, current.content),
      },
    });
  }
}
