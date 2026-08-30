import type { SHA1 } from "nano-git";
import type { Repository } from "nano-git/repository/core";

import type { ChangesEvent } from "#domain/worktree";
import type { ManuscriptTreeSnapshot, ResourceTreeSnapshot } from "#domain/worktree";

import type { WorktreeRepository } from "../../db/repositories/worktree-repo";
import { RpcStreamPublisher } from "../../lib/stream-publisher";
import type { ObjectDatabase } from "../git/diff-utils";
import { ChangeTracker } from "../journal/change-tracker";
import { MANUSCRIPT_ROOT_ID } from "../manuscript/outline";
import { RESOURCES_DIR } from "../resources/paths";
import type { ManuscriptSnapshotState } from "../snapshots/manuscript";
import type { ResourceSnapshotState } from "../snapshots/resource";

export const MANUSCRIPT_ID_SIZE = 10;
export const RESOURCE_ID_SIZE = 10;
export const RESOURCES_INDEX_FILE = "index.json";
export const RESOURCES_FILES_DIR_NAME = "files";
export const RESOURCES_INDEX_PATH = `${RESOURCES_DIR}/${RESOURCES_INDEX_FILE}`;
export const RESOURCES_FILES_DIR = `${RESOURCES_DIR}/${RESOURCES_FILES_DIR_NAME}`;
export const AUTOSAVE_JOURNAL_MERGE_WINDOW_MS = 5 * 60 * 1000;
export const RESTORE_HUNK_JOURNAL_MERGE_WINDOW_MS = 5 * 60 * 1000;

export type WorktreeSessionState = {
  store: WorktreeRepository;
  objects: ObjectDatabase;
  repo: Repository;
  projectId: number;
  branchName: string;
  changesPublisher: RpcStreamPublisher<ChangesEvent>;
  changeTracker: ChangeTracker;
  baseCommitSha: SHA1 | null;
  revision: number;
  warning: string | null;
  manuscriptTree: ManuscriptTreeSnapshot;
  baseManuscriptTree: ManuscriptTreeSnapshot;
  resourceTree: ResourceTreeSnapshot;
  baseResourceTree: ResourceTreeSnapshot;
  currentManuscript: ManuscriptSnapshotState;
  baseManuscript: ManuscriptSnapshotState;
  currentResources: ResourceSnapshotState;
  baseResources: ResourceSnapshotState;
  resourcePathById: Map<string, string>;
  resourceIdByPath: Map<string, string>;
  /** Per-document content OCC; key = `manuscript:${id}` | `resource:${id}`. */
  documentContentRevisions: Map<string, number>;
  lastPublishedManuscriptTree: ManuscriptTreeSnapshot | null;
  lastPublishedResourceTree: ResourceTreeSnapshot | null;
};

export function createWorktreeSessionState(
  store: WorktreeRepository,
  objects: ObjectDatabase,
  repo: Repository,
  projectId: number,
  branchName: string,
): WorktreeSessionState {
  return {
    store,
    objects,
    repo,
    projectId,
    branchName,
    changesPublisher: new RpcStreamPublisher<ChangesEvent>(),
    changeTracker: new ChangeTracker(),
    baseCommitSha: null,
    revision: 0,
    warning: null,
    manuscriptTree: { rootId: MANUSCRIPT_ROOT_ID, nodes: {} },
    baseManuscriptTree: { rootId: MANUSCRIPT_ROOT_ID, nodes: {} },
    resourceTree: { rootId: "", nodes: {} },
    baseResourceTree: { rootId: "", nodes: {} },
    currentManuscript: {
      outline: { version: 1, rootId: MANUSCRIPT_ROOT_ID, nodes: {} },
      entries: new Map(),
    },
    baseManuscript: {
      outline: { version: 1, rootId: MANUSCRIPT_ROOT_ID, nodes: {} },
      entries: new Map(),
    },
    currentResources: { entries: new Map() },
    baseResources: { entries: new Map() },
    resourcePathById: new Map(),
    resourceIdByPath: new Map(),
    documentContentRevisions: new Map(),
    lastPublishedManuscriptTree: null,
    lastPublishedResourceTree: null,
  };
}
