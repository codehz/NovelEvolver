import type {
  ManuscriptTreeNode,
  ManuscriptTreeSnapshot,
  ResourceTreeNode,
  ResourceTreeSnapshot,
} from "#shared/rpc/worktree-tree-rpc";

import type {
  ManuscriptNodeCommittedRow,
  ManuscriptNodeCurrentRow,
  ResourceNodeCommittedRow,
  ResourceNodeCurrentRow,
} from "../../db/repositories/worktree-repo";
import { MANUSCRIPT_ROOT_ID } from "../manuscript/outline";
import { RESOURCE_ROOT_ID } from "../resources/index";

export function buildResourceTreeFromCurrentRows(
  rows: readonly ResourceNodeCurrentRow[],
): ResourceTreeSnapshot {
  const nodes: Record<string, ResourceTreeNode> = {};
  const childRowsByParentId = new Map<string, ResourceNodeCurrentRow[]>();

  for (const row of rows) {
    nodes[row.id] = {
      id: row.id,
      type: row.type,
      name: row.name,
      parentId: row.parentId,
      childIds: [],
    };
    if (row.parentId !== null) {
      const siblings = childRowsByParentId.get(row.parentId) ?? [];
      siblings.push(row);
      childRowsByParentId.set(row.parentId, siblings);
    }
  }

  for (const [parentId, childRows] of childRowsByParentId.entries()) {
    const parent = nodes[parentId];
    if (parent === undefined || parent.type !== "folder") {
      throw new Error(`Invalid resource parent: ${parentId}`);
    }
    childRows
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === "folder" ? -1 : 1;
        }
        return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
      })
      .forEach((row) => parent.childIds.push(row.id));
  }

  const root = nodes[RESOURCE_ROOT_ID];
  if (root === undefined || root.type !== "folder" || root.parentId !== null) {
    throw new Error("Resource root is missing.");
  }

  return {
    rootId: RESOURCE_ROOT_ID,
    nodes,
  };
}

export function buildResourceTreeFromCommittedRows(
  rows: readonly ResourceNodeCommittedRow[],
): ResourceTreeSnapshot {
  return buildResourceTreeFromCurrentRows(
    rows.map((row) => ({
      projectId: row.projectId,
      branchName: row.branchName,
      id: row.id,
      parentId: row.parentId,
      type: row.type,
      name: row.name,
      content: null,
    })),
  );
}

export function buildManuscriptTreeFromCurrentRows(
  rows: readonly ManuscriptNodeCurrentRow[],
): ManuscriptTreeSnapshot {
  const nodes: Record<string, ManuscriptTreeNode> = {};
  const childRowsByParentId = new Map<string, ManuscriptNodeCurrentRow[]>();

  for (const row of rows) {
    nodes[row.id] = {
      id: row.id,
      type: row.type,
      title: row.title,
      parentId: row.parentId,
      childIds: [],
    };
    if (row.parentId !== null) {
      const siblings = childRowsByParentId.get(row.parentId) ?? [];
      siblings.push(row);
      childRowsByParentId.set(row.parentId, siblings);
    }
  }

  for (const [parentId, childRows] of childRowsByParentId.entries()) {
    const parent = nodes[parentId];
    if (parent === undefined || parent.type !== "folder") {
      throw new Error(`Invalid manuscript parent: ${parentId}`);
    }
    childRows
      .sort((left, right) => left.sortIndex - right.sortIndex || left.id.localeCompare(right.id))
      .forEach((row) => parent.childIds.push(row.id));
  }

  const root = nodes[MANUSCRIPT_ROOT_ID];
  if (root === undefined || root.type !== "folder" || root.parentId !== null) {
    throw new Error("Manuscript root is missing.");
  }

  return {
    rootId: MANUSCRIPT_ROOT_ID,
    nodes,
  };
}

export function buildManuscriptTreeFromCommittedRows(
  rows: readonly ManuscriptNodeCommittedRow[],
): ManuscriptTreeSnapshot {
  return buildManuscriptTreeFromCurrentRows(
    rows.map((row) => ({
      projectId: row.projectId,
      branchName: row.branchName,
      id: row.id,
      parentId: row.parentId,
      type: row.type,
      title: row.title,
      sortIndex: row.sortIndex,
      content: null,
    })),
  );
}
