import type { Change, ChangesSnapshot } from "@novelevolver/domain/worktree";

import { computeStats } from "../git/diff-utils";
import type { ManuscriptEntry, ManuscriptSnapshotState } from "../snapshots/manuscript";
import type { ResourceSnapshotEntry, ResourceSnapshotState } from "../snapshots/resource";
import { computeMinimalReorderedManuscriptIds } from "./manuscript-reorder";

type PendingProjectionOptions = {
  revision: number;
  baseTree: string;
  warning: string | null;
  baseManuscript: ManuscriptSnapshotState;
  currentManuscript: ManuscriptSnapshotState;
  baseResources: ResourceSnapshotState;
  currentResources: ResourceSnapshotState;
};

type ProjectedChange = Change & {
  order: number;
};

type ProjectedPendingChanges = {
  manuscriptChanges: ProjectedChange[];
  resourceChanges: ProjectedChange[];
};

export function buildJournalChangesSnapshot(options: PendingProjectionOptions): ChangesSnapshot {
  const projection = buildProjectedPendingChanges(options);
  return {
    revision: options.revision,
    baseTree: options.baseTree,
    hasChanges: projection.manuscriptChanges.length > 0 || projection.resourceChanges.length > 0,
    warning: options.warning,
    manuscriptChanges: projection.manuscriptChanges.map(toChange),
    resourceChanges: projection.resourceChanges.map(toChange),
  };
}

function buildProjectedPendingChanges(options: PendingProjectionOptions): ProjectedPendingChanges {
  const manuscriptChanges = collectManuscriptChanges(options);
  const resourceChanges = collectResourceChanges(options);
  sortChanges(manuscriptChanges);
  sortChanges(resourceChanges);

  return {
    manuscriptChanges,
    resourceChanges,
  };
}

function collectManuscriptChanges(options: PendingProjectionOptions): ProjectedChange[] {
  const changes: ProjectedChange[] = [];
  const ids = new Set([
    ...options.baseManuscript.entries.keys(),
    ...options.currentManuscript.entries.keys(),
  ]);
  const reorderedIds = computeMinimalReorderedManuscriptIds(
    options.baseManuscript,
    options.currentManuscript,
  );

  for (const id of ids) {
    const previous = options.baseManuscript.entries.get(id) ?? null;
    const current = options.currentManuscript.entries.get(id) ?? null;
    appendManuscriptChange(changes, id, previous, current, reorderedIds.has(id));
  }

  return changes;
}

function appendManuscriptChange(
  changes: ProjectedChange[],
  id: string,
  previous: ManuscriptEntry | null,
  current: ManuscriptEntry | null,
  reordered: boolean,
): void {
  if (previous === null && current !== null) {
    changes.push({
      id: `manuscript:create:${id}`,
      domain: "manuscript",
      kind: "create",
      entityId: id,
      entityKind: current.type === "chapter" ? "chapter" : "folder",
      label: current.title,
      displayPath: current.displayPath,
      depth: current.depth,
      order: current.order,
      stats:
        current.type === "chapter" && current.content !== ""
          ? { added: current.content.length, removed: 0 }
          : undefined,
    });
    return;
  }

  if (previous !== null && current === null) {
    changes.push({
      id: `manuscript:delete:${id}`,
      domain: "manuscript",
      kind: "delete",
      entityId: id,
      entityKind: previous.type === "chapter" ? "chapter" : "folder",
      label: previous.title,
      displayPath: previous.displayPath,
      depth: previous.depth,
      order: previous.order,
      stats:
        previous.type === "chapter" && previous.content !== ""
          ? { added: 0, removed: previous.content.length }
          : undefined,
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
      id: `manuscript:rename:${id}`,
      domain: "manuscript",
      kind: "rename",
      entityId: id,
      entityKind,
      label: current.title,
      previousLabel: previous.title,
      displayPath: current.displayPath,
      depth: current.depth,
      order,
    });
  }

  if (previous.parentId !== current.parentId) {
    changes.push({
      id: `manuscript:move:${id}`,
      domain: "manuscript",
      kind: "move",
      entityId: id,
      entityKind,
      label: current.title,
      previousPath: previous.displayPath,
      displayPath: current.displayPath,
      depth: current.depth,
      order,
    });
  } else if (reordered) {
    changes.push({
      id: `manuscript:reorder:${id}`,
      domain: "manuscript",
      kind: "reorder",
      entityId: id,
      entityKind,
      label: current.title,
      previousPath: previous.displayPath,
      displayPath: current.displayPath,
      depth: current.depth,
      order,
    });
  }

  if (current.type === "chapter" && previous.content !== current.content) {
    changes.push({
      id: `manuscript:content:${id}`,
      domain: "manuscript",
      kind: "content",
      entityId: id,
      entityKind: "chapter",
      label: current.title,
      displayPath: current.displayPath,
      depth: current.depth,
      order,
      stats: computeStats(previous.content, current.content),
    });
  }
}

function collectResourceChanges(options: PendingProjectionOptions): ProjectedChange[] {
  const changes: ProjectedChange[] = [];
  const ids = new Set([
    ...options.baseResources.entries.keys(),
    ...options.currentResources.entries.keys(),
  ]);

  for (const id of ids) {
    const previous = options.baseResources.entries.get(id) ?? null;
    const current = options.currentResources.entries.get(id) ?? null;
    appendResourceChange(changes, id, previous, current);
  }

  return changes;
}

function appendResourceChange(
  changes: ProjectedChange[],
  id: string,
  previous: ResourceSnapshotEntry | null,
  current: ResourceSnapshotEntry | null,
): void {
  if (previous === null && current !== null) {
    changes.push({
      id: `resource:create:${id}`,
      domain: "resource",
      kind: "create",
      entityId: id,
      entityKind: current.type === "file" ? "file" : "folder",
      label: current.name,
      displayPath: current.displayPath,
      depth: current.depth,
      order: current.order,
      stats:
        current.type === "file" && current.content !== ""
          ? { added: current.content.length, removed: 0 }
          : undefined,
    });
    return;
  }

  if (previous !== null && current === null) {
    changes.push({
      id: `resource:delete:${id}`,
      domain: "resource",
      kind: "delete",
      entityId: id,
      entityKind: previous.type === "file" ? "file" : "folder",
      label: previous.name,
      displayPath: previous.displayPath,
      depth: previous.depth,
      order: previous.order,
      stats:
        previous.type === "file" && previous.content !== ""
          ? { added: 0, removed: previous.content.length }
          : undefined,
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
      id: `resource:rename:${id}`,
      domain: "resource",
      kind: "rename",
      entityId: id,
      entityKind,
      label: current.name,
      previousLabel: previous.name,
      displayPath: current.displayPath,
      depth: current.depth,
      order,
    });
  }

  if (previous.parentId !== current.parentId) {
    changes.push({
      id: `resource:move:${id}`,
      domain: "resource",
      kind: "move",
      entityId: id,
      entityKind,
      label: current.name,
      previousPath: previous.displayPath,
      displayPath: current.displayPath,
      depth: current.depth,
      order,
    });
  }

  if (current.type === "file" && previous.content !== current.content) {
    changes.push({
      id: `resource:content:${id}`,
      domain: "resource",
      kind: "content",
      entityId: id,
      entityKind: "file",
      label: current.name,
      displayPath: current.displayPath,
      depth: current.depth,
      order,
      stats: computeStats(previous.content, current.content),
    });
  }
}

function sortChanges(changes: ProjectedChange[]): void {
  changes.sort((left, right) => {
    return left.order - right.order || left.displayPath.localeCompare(right.displayPath);
  });
}

function toChange(change: ProjectedChange): Change {
  return change;
}
