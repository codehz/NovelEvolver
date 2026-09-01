import type {
  ChangeTextComparison,
  ChangeTextComparisonTarget,
  ChangesEvent,
  ChangesSnapshot,
  CommitChangeTextComparison,
  CommitChangesSnapshot,
  CommitSummary,
  ExternalImportEntry,
  HistoryEntry,
  HistoryEntryContent,
  HistoryTarget,
  ManuscriptImportResult,
  ManuscriptOutline,
  ResourceImportEntry,
  ResourceImportResult,
  ResourceTreeSnapshot,
  WorktreeNodeIdResult,
  WorktreeReplaceQuery,
  WorktreeReplaceResult,
  WorktreeSearchQuery,
  WorktreeSearchResult,
  WorktreeTransferInput,
  WorktreeTransferResult,
} from "@novelevolver/domain/worktree";
import type { Repository } from "nano-git/repository/core";

import type { WorktreeRepository } from "../db/worktree-repo";
import type { ObjectDatabase } from "../git/diff-utils";
import { cloneResourceTreeSnapshot } from "../trees/tree-clone";
import { manuscriptTreeToOutline } from "../trees/worktree-tree-bridge";
import * as changesOps from "./changes-ops";
import { currentChangesOnlySnapshot } from "./changes-snapshot";
import {
  getDocumentContentRevision as getDocumentContentRevisionFromState,
  type DocumentRevisionDomain,
} from "./document-revision";
import { resolveBaseTree } from "./helpers";
import * as historyOps from "./history-ops";
import {
  hasPendingChanges as worktreeHasPendingChanges,
  loadOrSeed,
  realignToBranchTip as worktreeRealignToBranchTip,
} from "./load";
import * as manuscriptOps from "./manuscript-ops";
import { replaceInWorktree } from "./replace-ops";
import * as resourceOps from "./resource-ops";
import { searchWorktree } from "./search-ops";
import { createWorktreeSessionState, type WorktreeSessionState } from "./state";
import * as transferOps from "./transfer-ops";

export type AiProjectStructureDomain = "manuscript" | "resource";

export type AiProjectStructureTarget = {
  domain: AiProjectStructureDomain;
  id: string;
};

export type AiTextDocumentInfo =
  | {
      domain: "manuscript";
      id: string;
      kind: "chapter";
      label: string;
      displayPath: string;
    }
  | {
      domain: "resource";
      id: string;
      kind: "file";
      label: string;
      displayPath: string;
    };

export type AiProjectNodeInfo = {
  domain: AiProjectStructureDomain;
  id: string;
  kind: "folder" | "chapter" | "file";
  label: string;
  displayPath: string;
};

export type AiProjectStructureManuscriptNode = {
  id: string;
  domain: "manuscript";
  kind: "folder" | "chapter";
  title: string;
  parentId: string | null;
  displayPath: string;
  childCount?: number;
  descendantCount?: number;
  expanded?: boolean;
  /** 仅 chapter：正文字符数（`content.length`）。 */
  charCount?: number;
};

export type AiProjectStructureResourceNode = {
  id: string;
  domain: "resource";
  kind: "folder" | "file";
  name: string;
  parentId: string | null;
  displayPath: string;
  childCount?: number;
  descendantCount?: number;
  expanded?: boolean;
  /** 仅 file：正文字符数（`content.length`）。 */
  charCount?: number;
};

export type AiProjectStructure = {
  budget: number;
  nodeCount: number;
  target?: AiProjectStructureTarget;
  manuscript?: {
    rootId: string;
    nodes: AiProjectStructureManuscriptNode[];
  };
  resource?: {
    rootId: string;
    nodes: AiProjectStructureResourceNode[];
  };
};

const AI_STRUCTURE_NODE_BUDGET = 100;

type StructureTreeNode = {
  id: string;
  type: "folder" | "chapter" | "file";
  parentId: string | null;
  childIds: string[];
};

type StructureCandidate = {
  domain: AiProjectStructureDomain;
  id: string;
  order: number;
};

export class WorktreeSession {
  readonly #state: WorktreeSessionState;
  #disposed = false;

  constructor(
    store: WorktreeRepository,
    objects: ObjectDatabase,
    repo: Repository,
    projectId: number,
    branchName: string,
  ) {
    this.#state = createWorktreeSessionState(store, objects, repo, projectId, branchName);
    loadOrSeed(this.#state);
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  get warning(): string | null {
    return this.#state.warning;
  }

  get baseTree(): string {
    return resolveBaseTree(this.#state);
  }

  getManuscriptOutline(): ManuscriptOutline {
    return manuscriptTreeToOutline(this.#state.manuscriptTree);
  }

  getResourceTree(): ResourceTreeSnapshot {
    return cloneResourceTreeSnapshot(this.#state.resourceTree);
  }

  hasCommittedTip(): boolean {
    return this.#state.repo.readBranch(this.#state.branchName) !== null;
  }

  subscribeChanges(): ReadableStream<ChangesEvent> {
    return changesOps.subscribeChanges(this.#state);
  }

  getChangesSnapshot(): ChangesSnapshot {
    return currentChangesOnlySnapshot(this.#state);
  }

  hasPendingChanges(): boolean {
    return worktreeHasPendingChanges(this.#state);
  }

  /**
   * Realign a clean draft to the current branch tip (monotonic revision + full snapshot).
   * Rejects when the draft has uncommitted changes.
   */
  realignToBranchTip(): ChangesSnapshot {
    return worktreeRealignToBranchTip(this.#state);
  }

  /** Per-document content OCC revision (not the global worktree revision). */
  getDocumentContentRevision(domain: DocumentRevisionDomain, id: string): number {
    return getDocumentContentRevisionFromState(this.#state, domain, id);
  }

  createManuscriptFolder(parentId: string, title: string, index?: number): WorktreeNodeIdResult {
    return manuscriptOps.createManuscriptFolder(this.#state, parentId, title, index);
  }

  createManuscriptChapter(parentId: string, title: string, index?: number): WorktreeNodeIdResult {
    return manuscriptOps.createManuscriptChapter(this.#state, parentId, title, index);
  }

  importManuscriptEntries(
    targetParentId: string,
    entries: readonly ExternalImportEntry[],
    index?: number,
  ): ManuscriptImportResult {
    return manuscriptOps.importManuscriptEntries(this.#state, targetParentId, entries, index);
  }

  renameManuscriptNode(id: string, title: string): void {
    manuscriptOps.renameManuscriptNode(this.#state, id, title);
  }

  moveManuscriptNode(id: string, targetParentId: string, index?: number): void {
    manuscriptOps.moveManuscriptNode(this.#state, id, targetParentId, index);
  }

  deleteManuscriptNode(id: string): void {
    manuscriptOps.deleteManuscriptNode(this.#state, id);
  }

  readChapter(id: string): string {
    return manuscriptOps.readChapter(this.#state, id);
  }

  writeChapter(id: string, content: string): void {
    manuscriptOps.writeChapter(this.#state, id, content);
  }

  createResourceFile(parentId: string, name: string): WorktreeNodeIdResult {
    return resourceOps.createResourceFile(this.#state, parentId, name);
  }

  createResourceFolder(parentId: string, name: string): WorktreeNodeIdResult {
    return resourceOps.createResourceFolder(this.#state, parentId, name);
  }

  importResourceEntries(
    targetParentId: string,
    entries: readonly ResourceImportEntry[],
  ): ResourceImportResult {
    return resourceOps.importResourceEntries(this.#state, targetParentId, entries);
  }

  renameResourceNode(id: string, name: string): void {
    resourceOps.renameResourceNode(this.#state, id, name);
  }

  moveResourceNode(id: string, targetParentId: string): void {
    resourceOps.moveResourceNode(this.#state, id, targetParentId);
  }

  deleteResourceNode(id: string): void {
    resourceOps.deleteResourceNode(this.#state, id);
  }

  readResourceFile(id: string): string {
    return resourceOps.readResourceFile(this.#state, id);
  }

  readResourceFileByPath(relativePath: string): string {
    return resourceOps.readResourceFileByPath(this.#state, relativePath);
  }

  listResourceFiles(path: string): resourceOps.ResourceFileListEntry[] {
    return resourceOps.listResourceFiles(this.#state, path);
  }

  writeResourceFile(id: string, content: string): void {
    resourceOps.writeResourceFile(this.#state, id, content);
  }

  transferNode(input: WorktreeTransferInput): WorktreeTransferResult {
    return transferOps.transferNode(this.#state, input);
  }

  revertChange(changeId: string): ChangesSnapshot {
    return changesOps.revertChange(this.#state, changeId);
  }

  revertAllChanges(): ChangesSnapshot {
    return changesOps.revertAllChanges(this.#state);
  }

  readChangeTextComparison(changeId: string): ChangeTextComparison {
    return changesOps.readChangeTextComparison(this.#state, changeId);
  }

  readChangeTextComparisonByTarget(target: ChangeTextComparisonTarget): ChangeTextComparison {
    return changesOps.readChangeTextComparisonByTarget(this.#state, target);
  }

  restoreChangeTextHunk(
    target: ChangeTextComparisonTarget,
    expectedContent: string,
    nextContent: string,
  ): void {
    changesOps.restoreChangeTextHunk(this.#state, target, expectedContent, nextContent);
  }

  commitChanges(message: string, author: { name: string; email: string }): ChangesSnapshot {
    return changesOps.commitChanges(this.#state, message, author);
  }

  listBranchCommits(maxCount = 50): CommitSummary[] {
    return historyOps.listBranchCommits(this.#state, maxCount);
  }

  listCommitChanges(commitHash: string): CommitChangesSnapshot {
    return historyOps.listCommitChanges(this.#state, commitHash);
  }

  readCommitChangeTextComparison(
    commitHash: string,
    target: ChangeTextComparisonTarget,
  ): CommitChangeTextComparison {
    return historyOps.readCommitChangeTextComparison(this.#state, commitHash, target);
  }

  listFileHistory(target: HistoryTarget, limit = 50): HistoryEntry[] {
    return historyOps.listFileHistory(this.#state, target, limit);
  }

  readHistoryEntryContent(entryId: string): HistoryEntryContent {
    return historyOps.readHistoryEntryContent(this.#state, entryId);
  }

  readHistoryEntry(entryId: string): HistoryEntry {
    return historyOps.readHistoryEntry(this.#state, entryId);
  }

  restoreHistoryEntryContentHunk(
    entryId: string,
    expectedContent: string,
    nextContent: string,
  ): void {
    historyOps.restoreHistoryEntryContentHunk(this.#state, entryId, expectedContent, nextContent);
  }

  restoreWorkingTreeFromCommit(commitHash: string): ChangesSnapshot {
    return historyOps.restoreWorkingTreeFromCommit(this.#state, commitHash);
  }

  restoreEntityFromCommit(commitHash: string, target: HistoryTarget): ChangesSnapshot {
    return historyOps.restoreEntityFromCommit(this.#state, commitHash, target);
  }

  restoreEntityFromHistoryEntry(entryId: string): ChangesSnapshot {
    return historyOps.restoreEntityFromHistoryEntry(this.#state, entryId);
  }

  searchWorktree(options: WorktreeSearchQuery): WorktreeSearchResult {
    return searchWorktree(this.#state, options);
  }

  replaceInWorktree(options: WorktreeReplaceQuery): WorktreeReplaceResult {
    return replaceInWorktree(this.#state, options);
  }

  getTextDocumentInfo(domain: AiProjectStructureDomain, id: string): AiTextDocumentInfo {
    if (domain === "manuscript") {
      const entry = this.#state.currentManuscript.entries.get(id);
      if (!entry) throw new Error(`manuscript 节点不存在: ${id}`);
      if (entry.type !== "chapter") throw new Error("manuscript 文本节点必须是章节。");
      return {
        domain,
        id,
        kind: "chapter",
        label: entry.title,
        displayPath: entry.displayPath,
      };
    }

    const entry = this.#state.currentResources.entries.get(id);
    if (!entry) throw new Error(`resource 节点不存在: ${id}`);
    if (entry.type !== "file") throw new Error("resource 文本节点必须是文件。");
    return {
      domain,
      id,
      kind: "file",
      label: entry.name,
      displayPath: entry.displayPath,
    };
  }

  getProjectNodeInfo(domain: AiProjectStructureDomain, id: string): AiProjectNodeInfo {
    if (domain === "manuscript") {
      const entry = this.#state.currentManuscript.entries.get(id);
      if (!entry) throw new Error(`manuscript 节点不存在: ${id}`);
      return {
        domain,
        id,
        kind: entry.type,
        label: entry.title,
        displayPath: entry.displayPath,
      };
    }

    const entry = this.#state.currentResources.entries.get(id);
    if (!entry) throw new Error(`resource 节点不存在: ${id}`);
    return {
      domain,
      id,
      kind: entry.type,
      label: entry.name,
      displayPath: entry.displayPath,
    };
  }

  getProjectStructure(target?: AiProjectStructureTarget): AiProjectStructure {
    const domains: AiProjectStructureDomain[] = target
      ? [target.domain]
      : ["manuscript", "resource"];
    const included = new Map<string, Set<string>>();
    const expanded = new Map<string, Set<string>>();
    const descendantCounts = new Map<string, number>();
    const candidates: StructureCandidate[] = [];
    let candidateOrder = 0;

    const treeFor = (domain: AiProjectStructureDomain) =>
      domain === "manuscript" ? this.#state.manuscriptTree : this.#state.resourceTree;
    const keyFor = (domain: AiProjectStructureDomain, id: string) => `${domain}:${id}`;
    const countDescendants = (domain: AiProjectStructureDomain, id: string): number => {
      const key = keyFor(domain, id);
      const cached = descendantCounts.get(key);
      if (cached !== undefined) return cached;
      const node = treeFor(domain).nodes[id] as StructureTreeNode | undefined;
      if (!node) throw new Error(`${domain} 节点不存在: ${id}`);
      const count = node.childIds.reduce(
        (total, childId) => total + 1 + countDescendants(domain, childId),
        0,
      );
      descendantCounts.set(key, count);
      return count;
    };
    const include = (domain: AiProjectStructureDomain, id: string): void => {
      const ids = included.get(domain) ?? new Set<string>();
      ids.add(id);
      included.set(domain, ids);
    };
    const queueCandidate = (domain: AiProjectStructureDomain, id: string): void => {
      const node = treeFor(domain).nodes[id] as StructureTreeNode;
      if (node.type === "folder" && node.childIds.length > 0) {
        candidates.push({ domain, id, order: candidateOrder++ });
      }
    };
    const expand = (domain: AiProjectStructureDomain, id: string): void => {
      const node = treeFor(domain).nodes[id] as StructureTreeNode;
      const ids = expanded.get(domain) ?? new Set<string>();
      ids.add(id);
      expanded.set(domain, ids);
      for (const childId of node.childIds) {
        include(domain, childId);
        queueCandidate(domain, childId);
      }
    };

    for (const domain of domains) {
      const tree = treeFor(domain);
      const startId = target?.id ?? tree.rootId;
      const start = tree.nodes[startId] as StructureTreeNode | undefined;
      if (!start) throw new Error(`${domain} 节点不存在: ${startId}`);
      if (start.type !== "folder") throw new Error("read_structure 的 target 必须是文件夹。");
      countDescendants(domain, startId);
      include(domain, startId);
      expand(domain, startId);
    }

    let nodeCount = [...included.values()].reduce((total, ids) => total + ids.size, 0);
    while (nodeCount < AI_STRUCTURE_NODE_BUDGET) {
      candidates.sort((left, right) => {
        const leftNode = treeFor(left.domain).nodes[left.id] as StructureTreeNode;
        const rightNode = treeFor(right.domain).nodes[right.id] as StructureTreeNode;
        return leftNode.childIds.length - rightNode.childIds.length || left.order - right.order;
      });
      const index = candidates.findIndex((candidate) => {
        const node = treeFor(candidate.domain).nodes[candidate.id] as StructureTreeNode;
        return nodeCount + node.childIds.length <= AI_STRUCTURE_NODE_BUDGET;
      });
      if (index < 0) break;
      const [candidate] = candidates.splice(index, 1);
      expand(candidate.domain, candidate.id);
      nodeCount = [...included.values()].reduce((total, ids) => total + ids.size, 0);
    }

    const result: AiProjectStructure = { budget: AI_STRUCTURE_NODE_BUDGET, nodeCount, target };
    for (const domain of domains) {
      const tree = treeFor(domain);
      const nodes = [...(included.get(domain) ?? [])].map((id) => {
        const node = tree.nodes[id] as StructureTreeNode;
        const directory =
          node.type === "folder"
            ? {
                childCount: node.childIds.length,
                descendantCount: countDescendants(domain, id),
                expanded: node.childIds.length === 0 || expanded.get(domain)?.has(id) === true,
              }
            : {};
        if (domain === "manuscript") {
          const entry = this.#state.currentManuscript.entries.get(id);
          return {
            id,
            domain,
            kind: node.type as "folder" | "chapter",
            title: entry?.title ?? (node as typeof node & { title?: string }).title ?? "",
            parentId: node.parentId,
            displayPath: entry?.displayPath ?? "",
            ...(node.type === "chapter" ? { charCount: entry?.content.length ?? 0 } : {}),
            ...directory,
          } satisfies AiProjectStructureManuscriptNode;
        }
        const entry = this.#state.currentResources.entries.get(id);
        return {
          id,
          domain,
          kind: node.type as "folder" | "file",
          name: entry?.name ?? (node as typeof node & { name?: string }).name ?? "",
          parentId: node.parentId,
          displayPath: entry?.displayPath ?? "",
          ...(node.type === "file" ? { charCount: entry?.content.length ?? 0 } : {}),
          ...directory,
        } satisfies AiProjectStructureResourceNode;
      });
      if (domain === "manuscript") {
        result.manuscript = {
          rootId: this.#state.manuscriptTree.rootId,
          nodes: nodes as AiProjectStructureManuscriptNode[],
        };
      } else {
        result.resource = {
          rootId: this.#state.resourceTree.rootId,
          nodes: nodes as AiProjectStructureResourceNode[],
        };
      }
    }
    return result;
  }

  [Symbol.dispose](): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#state.changesPublisher[Symbol.dispose]();
  }
}
