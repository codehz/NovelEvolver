import type { Repository } from "nano-git/repository/core";

import type {
  CommitSummary,
  HistoryEntry,
  HistoryEntryContent,
  HistoryTarget,
} from "#shared/rpc/worktree/index";
import type { WorktreeNodeIdResult } from "#shared/rpc/worktree/index";
import type {
  ChangeTextComparison,
  ChangeTextComparisonTarget,
  ChangesEvent,
  ChangesSnapshot,
} from "#shared/rpc/worktree/index";
import type { WorktreeSearchQuery, WorktreeSearchResult } from "#shared/rpc/worktree/index";

import type { WorktreeRepository } from "../../db/repositories/worktree-repo";
import type { ObjectDatabase } from "../git/diff-utils";
import * as changesOps from "./changes-ops";
import { resolveBaseTree } from "./helpers";
import * as historyOps from "./history-ops";
import { loadOrSeed } from "./load";
import * as manuscriptOps from "./manuscript-ops";
import * as resourceOps from "./resource-ops";
import { searchWorktree } from "./search-ops";
import { createWorktreeSessionState, type WorktreeSessionState } from "./state";

export class WorktreeSession {
  readonly #state: WorktreeSessionState;

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

  get baseTree(): string {
    return resolveBaseTree(this.#state);
  }

  subscribeChanges(): ReadableStream<ChangesEvent> {
    return changesOps.subscribeChanges(this.#state);
  }

  createManuscriptFolder(parentId: string, title: string, index?: number): WorktreeNodeIdResult {
    return manuscriptOps.createManuscriptFolder(this.#state, parentId, title, index);
  }

  createManuscriptChapter(parentId: string, title: string, index?: number): WorktreeNodeIdResult {
    return manuscriptOps.createManuscriptChapter(this.#state, parentId, title, index);
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

  revertChange(changeId: string): ChangesSnapshot {
    return changesOps.revertChange(this.#state, changeId);
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

  listFileHistory(target: HistoryTarget, limit = 50): HistoryEntry[] {
    return historyOps.listFileHistory(this.#state, target, limit);
  }

  readHistoryEntryContent(entryId: string): HistoryEntryContent {
    return historyOps.readHistoryEntryContent(this.#state, entryId);
  }

  restoreHistoryEntryContentHunk(
    entryId: string,
    expectedContent: string,
    nextContent: string,
  ): void {
    historyOps.restoreHistoryEntryContentHunk(this.#state, entryId, expectedContent, nextContent);
  }

  searchWorktree(options: WorktreeSearchQuery): WorktreeSearchResult {
    return searchWorktree(this.#state, options);
  }

  [Symbol.dispose](): void {
    this.#state.changesPublisher[Symbol.dispose]();
  }
}
