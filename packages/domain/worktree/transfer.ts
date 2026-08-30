import type { WorktreeDomain } from "./worktree-domain";

/** Input for atomic cross-domain move (manuscript ↔ resource). Domains must differ. */
export type WorktreeTransferInput = {
  sourceDomain: WorktreeDomain;
  sourceId: string;
  targetDomain: WorktreeDomain;
  targetParentId: string;
  /** Insertion index under manuscript target parent; omit = append. Ignored for resource target. */
  index?: number;
};

export type WorktreeTransferCreated = {
  domain: WorktreeDomain;
  nodeId: string;
  kind: "chapter" | "folder" | "file";
  label: string;
};

export type WorktreeTransferResult = {
  sourceRootId: string;
  removedSourceIds: string[];
  created: WorktreeTransferCreated[];
};
