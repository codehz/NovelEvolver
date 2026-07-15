import type { Change, CommitSummary } from "#shared/rpc/worktree/index";
import {
  buildChangeRoots,
  collectChangeTreeFolderKeys,
  flattenChangeTree,
  type ChangeTreeFolderNode,
} from "#workbench/changes/change-tree-projector";
import { contentDomainIconClass } from "#workbench/tree/content-tree-icons";

import type { CommitChangesCacheEntry } from "./use-commit-changes-state";

export type HistoryFlatRow =
  | {
      kind: "commit";
      key: string;
      commit: CommitSummary;
      isHead: boolean;
      expanded: boolean;
    }
  | {
      kind: "status";
      key: string;
      commitHash: string;
      status: "loading" | "error" | "empty";
      message?: string;
      depth: number;
    }
  | {
      kind: "domain";
      key: string;
      commitHash: string;
      domainKey: string;
      title: string;
      iconClass: string;
      depth: number;
      expanded: boolean;
      childCount: number;
    }
  | {
      kind: "folder";
      key: string;
      commitHash: string;
      folderKey: string;
      node: ChangeTreeFolderNode;
      depth: number;
      expanded: boolean;
      childCount: number;
      inlineChange: Change | null;
    }
  | {
      kind: "change";
      key: string;
      commitHash: string;
      item: Change;
      depth: number;
    };

export function historyDomainScopeKey(commitHash: string, domainKey: string): string {
  return `${commitHash}::domain::${domainKey}`;
}

export function historyFolderScopeKey(commitHash: string, folderKey: string): string {
  return `${commitHash}::folder::${folderKey}`;
}

/** Keys to seed expanded when a commit's change tree first becomes ready. */
export function collectCommitExpansionSeedKeys(
  commitHash: string,
  manuscriptChanges: readonly Change[],
  resourceChanges: readonly Change[],
): { domainKeys: string[]; folderKeys: string[] } {
  const roots = buildChangeRoots(manuscriptChanges, resourceChanges, contentDomainIconClass);
  return {
    domainKeys: roots.map((root) => historyDomainScopeKey(commitHash, root.id)),
    folderKeys: collectChangeTreeFolderKeys(roots).map((folderKey) =>
      historyFolderScopeKey(commitHash, folderKey),
    ),
  };
}

export function flattenHistoryTree(
  commits: readonly CommitSummary[],
  expandedHashes: ReadonlySet<string>,
  cache: ReadonlyMap<string, CommitChangesCacheEntry>,
  expandedDomainKeys: ReadonlySet<string>,
  expandedFolderKeys: ReadonlySet<string>,
): HistoryFlatRow[] {
  const rows: HistoryFlatRow[] = [];

  commits.forEach((commit, index) => {
    const expanded = expandedHashes.has(commit.hash);
    rows.push({
      kind: "commit",
      key: `commit:${commit.hash}`,
      commit,
      isHead: index === 0,
      expanded,
    });

    if (!expanded) {
      return;
    }

    const entry = cache.get(commit.hash);
    if (entry === undefined || entry.status === "loading") {
      rows.push({
        kind: "status",
        key: `commit:${commit.hash}:status`,
        commitHash: commit.hash,
        status: "loading",
        depth: 1,
      });
      return;
    }

    if (entry.status === "error") {
      rows.push({
        kind: "status",
        key: `commit:${commit.hash}:status`,
        commitHash: commit.hash,
        status: "error",
        message: entry.message,
        depth: 1,
      });
      return;
    }

    const roots = buildChangeRoots(
      entry.snapshot.manuscriptChanges,
      entry.snapshot.resourceChanges,
      contentDomainIconClass,
    );
    if (roots.length === 0) {
      rows.push({
        kind: "status",
        key: `commit:${commit.hash}:status`,
        commitHash: commit.hash,
        status: "empty",
        depth: 1,
      });
      return;
    }

    const domainExpanded = new Set(
      roots
        .map((root) => root.id)
        .filter((domainKey) =>
          expandedDomainKeys.has(historyDomainScopeKey(commit.hash, domainKey)),
        ),
    );
    const folderExpanded = new Set(
      collectChangeTreeFolderKeys(roots).filter((folderKey) =>
        expandedFolderKeys.has(historyFolderScopeKey(commit.hash, folderKey)),
      ),
    );
    const changeRows = flattenChangeTree(roots, domainExpanded, folderExpanded, 1);
    for (const row of changeRows) {
      if (row.kind === "domain") {
        rows.push({
          kind: "domain",
          key: `commit:${commit.hash}:domain:${row.key}`,
          commitHash: commit.hash,
          domainKey: row.key,
          title: row.title,
          iconClass: row.iconClass,
          depth: row.depth,
          expanded: row.expanded,
          childCount: row.childCount,
        });
        continue;
      }
      if (row.kind === "folder") {
        rows.push({
          kind: "folder",
          key: `commit:${commit.hash}:folder:${row.key}`,
          commitHash: commit.hash,
          folderKey: row.key,
          node: row.node,
          depth: row.depth,
          expanded: row.expanded,
          childCount: row.childCount,
          inlineChange: row.inlineChange,
        });
        continue;
      }
      rows.push({
        kind: "change",
        key: `commit:${commit.hash}:${row.key}`,
        commitHash: commit.hash,
        item: row.item,
        depth: row.depth,
      });
    }
  });

  return rows;
}
