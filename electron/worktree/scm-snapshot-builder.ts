import type { ScmChange, ScmSnapshot } from "#shared/rpc/worktree-scm";

import { computeStats } from "../diff/utils";
import type {
  ManuscriptEntry,
  ManuscriptSnapshotState,
  ResourceEntry,
  ResourceSnapshotState,
} from "./snapshot-state";

export type DetailedSnapshot = {
  snapshot: ScmSnapshot;
  changeHandlers: Map<string, () => void>;
};

type SnapshotHandlerFactory = {
  onManuscriptCreate: (id: string, current: ManuscriptEntry) => () => void;
  onManuscriptDelete: (
    id: string,
    previous: ManuscriptEntry,
    baseManuscript: ManuscriptSnapshotState,
  ) => () => void;
  onManuscriptRename: (
    id: string,
    previous: ManuscriptEntry,
    current: ManuscriptEntry,
  ) => () => void;
  onManuscriptMove: (id: string, previous: ManuscriptEntry, current: ManuscriptEntry) => () => void;
  onManuscriptReorder: (
    id: string,
    previous: ManuscriptEntry,
    current: ManuscriptEntry,
  ) => () => void;
  onManuscriptContent: (
    id: string,
    previous: ManuscriptEntry,
    current: ManuscriptEntry,
  ) => () => void;
  onResourceCreate: (path: string, current: ResourceEntry) => () => void;
  onResourceDelete: (path: string, previous: ResourceEntry) => () => void;
  onResourceContent: (path: string, previous: ResourceEntry, current: ResourceEntry) => () => void;
};

type BuildDetailedScmSnapshotOptions = {
  revision: number;
  baseTree: string;
  warning: string | null;
  baseManuscript: ManuscriptSnapshotState;
  currentManuscript: ManuscriptSnapshotState;
  baseResources: ResourceSnapshotState;
  currentResources: ResourceSnapshotState;
  handlers: SnapshotHandlerFactory;
};

export function buildDetailedScmSnapshot(
  options: BuildDetailedScmSnapshotOptions,
): DetailedSnapshot {
  const {
    revision,
    baseTree,
    warning,
    baseManuscript,
    currentManuscript,
    baseResources,
    currentResources,
    handlers,
  } = options;

  const manuscriptChanges: Array<{ change: ScmChange; order: number }> = [];
  const resourceChanges: Array<{ change: ScmChange; order: number }> = [];
  const changeHandlers = new Map<string, () => void>();

  const manuscriptIds = new Set<string>([
    ...baseManuscript.entries.keys(),
    ...currentManuscript.entries.keys(),
  ]);

  for (const id of manuscriptIds) {
    const previous = baseManuscript.entries.get(id) ?? null;
    const current = currentManuscript.entries.get(id) ?? null;

    if (previous === null && current !== null) {
      const change: ScmChange = {
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
      };
      manuscriptChanges.push({ change, order: current.order });
      changeHandlers.set(change.id, handlers.onManuscriptCreate(id, current));
      continue;
    }

    if (previous !== null && current === null) {
      const change: ScmChange = {
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
      };
      manuscriptChanges.push({ change, order: previous.order });
      changeHandlers.set(change.id, handlers.onManuscriptDelete(id, previous, baseManuscript));
      continue;
    }

    if (previous === null || current === null) {
      continue;
    }

    const entityKind = current.type === "chapter" ? "chapter" : "folder";
    const displayPath = current.displayPath;
    const depth = current.depth;
    const order = current.order;

    if (previous.title !== current.title) {
      const change: ScmChange = {
        id: `manuscript:rename:${id}`,
        domain: "manuscript",
        kind: "rename",
        entityId: id,
        entityKind,
        label: current.title,
        previousLabel: previous.title,
        displayPath,
        depth,
      };
      manuscriptChanges.push({ change, order });
      changeHandlers.set(change.id, handlers.onManuscriptRename(id, previous, current));
    }

    if (previous.parentId !== current.parentId) {
      const change: ScmChange = {
        id: `manuscript:move:${id}`,
        domain: "manuscript",
        kind: "move",
        entityId: id,
        entityKind,
        label: current.title,
        previousPath: previous.displayPath,
        displayPath,
        depth,
      };
      manuscriptChanges.push({ change, order });
      changeHandlers.set(change.id, handlers.onManuscriptMove(id, previous, current));
    } else if (previous.index !== current.index) {
      const change: ScmChange = {
        id: `manuscript:reorder:${id}`,
        domain: "manuscript",
        kind: "reorder",
        entityId: id,
        entityKind,
        label: current.title,
        previousPath: previous.displayPath,
        displayPath,
        depth,
      };
      manuscriptChanges.push({ change, order });
      changeHandlers.set(change.id, handlers.onManuscriptReorder(id, previous, current));
    }

    if (current.type === "chapter" && previous.content !== current.content) {
      const change: ScmChange = {
        id: `manuscript:content:${id}`,
        domain: "manuscript",
        kind: "content",
        entityId: id,
        entityKind: "chapter",
        label: current.title,
        displayPath,
        depth,
        stats: computeStats(previous.content, current.content),
      };
      manuscriptChanges.push({ change, order });
      changeHandlers.set(change.id, handlers.onManuscriptContent(id, previous, current));
    }
  }

  const resourcePaths = new Set<string>([
    ...baseResources.entries.keys(),
    ...currentResources.entries.keys(),
  ]);

  for (const path of resourcePaths) {
    const previous = baseResources.entries.get(path) ?? null;
    const current = currentResources.entries.get(path) ?? null;

    if (previous === null && current !== null) {
      const change: ScmChange = {
        id: `resource:create:${path}`,
        domain: "resource",
        kind: "create",
        entityId: path,
        entityKind: current.type,
        label: current.name,
        displayPath: current.displayPath,
        depth: current.depth,
        stats:
          current.type === "file" && current.content !== ""
            ? { added: current.content.length, removed: 0 }
            : undefined,
      };
      resourceChanges.push({ change, order: current.order });
      changeHandlers.set(change.id, handlers.onResourceCreate(path, current));
      continue;
    }

    if (previous !== null && current === null) {
      const change: ScmChange = {
        id: `resource:delete:${path}`,
        domain: "resource",
        kind: "delete",
        entityId: path,
        entityKind: previous.type,
        label: previous.name,
        displayPath: previous.displayPath,
        depth: previous.depth,
        stats:
          previous.type === "file" && previous.content !== ""
            ? { added: 0, removed: previous.content.length }
            : undefined,
      };
      resourceChanges.push({ change, order: previous.order });
      changeHandlers.set(change.id, handlers.onResourceDelete(path, previous));
      continue;
    }

    if (previous === null || current === null) {
      continue;
    }

    if (
      previous.type === "file" &&
      current.type === "file" &&
      previous.content !== current.content
    ) {
      const change: ScmChange = {
        id: `resource:content:${path}`,
        domain: "resource",
        kind: "content",
        entityId: path,
        entityKind: "file",
        label: current.name,
        displayPath: current.displayPath,
        depth: current.depth,
        stats: computeStats(previous.content, current.content),
      };
      resourceChanges.push({ change, order: current.order });
      changeHandlers.set(change.id, handlers.onResourceContent(path, previous, current));
    }
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
    snapshot: {
      revision,
      baseTree,
      hasChanges: manuscriptChanges.length > 0 || resourceChanges.length > 0,
      warning,
      manuscriptChanges: manuscriptChanges.map((item) => item.change),
      resourceChanges: resourceChanges.map((item) => item.change),
    },
    changeHandlers,
  };
}
