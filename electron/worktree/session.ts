import { createHash } from "node:crypto";

import type { SHA1 } from "nano-git";
import type { Repository } from "nano-git/repository/core";
import { readTreeSnapshot } from "nano-git/repository/tree/tree-diff";
import type { VirtualWorktree } from "nano-git/worktree/core";
import { nanoid } from "nanoid";

import {
  normalizeResourceNameInput,
  resourceBaseName,
  resourceParentPath,
} from "#shared/resource-library-path";
import type {
  ManuscriptNode,
  ManuscriptOutline,
  WorktreeNodeIdResult,
} from "#shared/rpc/projects-rpc";
import type { ScmChange, ScmChangeStats, ScmSnapshot } from "#shared/rpc/worktree-scm";
import type {
  ManuscriptTreeDelta,
  ManuscriptTreeNode,
  ManuscriptTreeSnapshot,
  ResourceTreeDelta,
  ResourceTreeNode,
  ResourceTreeSnapshot,
  TreeChildrenPatch,
  WorktreeTreeEvent,
  WorktreeTreeSnapshot,
} from "#shared/rpc/worktree-tree";

import { readTextFromTree } from "../diff/utils";
import {
  clampChildIndex,
  cloneOutline,
  collectDescendantIds,
  createEmptyOutline,
  findParentId,
  MANUSCRIPT_ROOT_ID,
  normalizeManuscriptTitle,
  parseOutline,
  validateOutline,
} from "../manuscript-outline";
import {
  chapterBodyPath,
  ensureManuscriptStorage,
  MANUSCRIPT_OUTLINE_PATH,
} from "../manuscript-path";
import {
  assertValidResourceRelativePath,
  ensureResourcesDirectory,
  joinWorktreeChild,
  RESOURCES_DIR,
  toWorktreePath,
} from "../resource-library-path";
import { RpcStreamPublisher } from "../rpc/stream-publisher";

type ObjectDatabase = Parameters<typeof readTreeSnapshot>[0];

type ManuscriptEntry = {
  id: string;
  type: ManuscriptNode["type"];
  title: string;
  parentId: string;
  index: number;
  depth: number;
  displayPath: string;
  order: number;
  childIds: string[];
  content: string;
};

type ManuscriptSnapshotState = {
  outline: ManuscriptOutline;
  entries: Map<string, ManuscriptEntry>;
};

type ResourceEntry = {
  path: string;
  type: "file" | "folder";
  name: string;
  parentPath: string;
  depth: number;
  displayPath: string;
  order: number;
  content: string;
  hash: string;
};

type ResourceSnapshotState = {
  entries: Map<string, ResourceEntry>;
};

type DetailedSnapshot = {
  snapshot: ScmSnapshot;
  changeHandlers: Map<string, () => void>;
};

type ExistingWorktreeStatus = {
  hadExistingDraft: boolean;
};

type TreeMutation = {
  manuscript?: ManuscriptTreeDelta;
  resources?: ResourceTreeDelta;
  forceSnapshot?: boolean;
};

const MANUSCRIPT_ID_SIZE = 10;
const RESOURCE_ID_SIZE = 10;
const RESOURCE_ROOT_ID = "root";

function sha1Text(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

function computeStats(previous: string, current: string): ScmChangeStats {
  if (previous === current) {
    return { added: 0, removed: 0 };
  }
  if (previous === "") {
    return { added: current.length, removed: 0 };
  }
  if (current === "") {
    return { added: 0, removed: previous.length };
  }

  const oldLines = previous.split("\n");
  const newLines = current.split("\n");
  const rows = oldLines.length;
  const cols = newLines.length;
  const dp: number[][] = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));

  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= cols; col += 1) {
      if (oldLines[row - 1] === newLines[col - 1]) {
        dp[row][col] = dp[row - 1]![col - 1]! + 1;
      } else {
        dp[row][col] = Math.max(dp[row - 1]![col]!, dp[row][col - 1]!);
      }
    }
  }

  let added = 0;
  let removed = 0;
  let row = rows;
  let col = cols;

  while (row > 0 || col > 0) {
    if (row > 0 && col > 0 && oldLines[row - 1] === newLines[col - 1]) {
      row -= 1;
      col -= 1;
      continue;
    }
    if (col > 0 && (row === 0 || dp[row]![col - 1]! >= dp[row - 1]![col]!)) {
      added += newLines[col - 1]!.length + 1;
      col -= 1;
      continue;
    }
    removed += oldLines[row - 1]!.length + 1;
    row -= 1;
  }

  return { added, removed };
}

function cloneManuscriptTreeNode(node: ManuscriptTreeNode): ManuscriptTreeNode {
  return {
    ...node,
    childIds: [...node.childIds],
  };
}

function cloneResourceTreeNode(node: ResourceTreeNode): ResourceTreeNode {
  return {
    ...node,
    childIds: [...node.childIds],
  };
}

function cloneManuscriptTreeSnapshot(snapshot: ManuscriptTreeSnapshot): ManuscriptTreeSnapshot {
  return {
    rootId: snapshot.rootId,
    nodes: Object.fromEntries(
      Object.entries(snapshot.nodes).map(([id, node]) => [id, cloneManuscriptTreeNode(node)]),
    ),
  };
}

function cloneResourceTreeSnapshot(snapshot: ResourceTreeSnapshot): ResourceTreeSnapshot {
  return {
    rootId: snapshot.rootId,
    nodes: Object.fromEntries(
      Object.entries(snapshot.nodes).map(([id, node]) => [id, cloneResourceTreeNode(node)]),
    ),
  };
}

function cloneManuscriptTreeDelta(delta: ManuscriptTreeDelta): ManuscriptTreeDelta {
  return {
    putNodes: Object.fromEntries(
      Object.entries(delta.putNodes).map(([id, node]) => [id, cloneManuscriptTreeNode(node)]),
    ),
    deleteNodeIds: [...delta.deleteNodeIds],
    setChildren: delta.setChildren.map((item) => ({
      parentId: item.parentId,
      childIds: [...item.childIds],
    })),
  };
}

function cloneResourceTreeDelta(delta: ResourceTreeDelta): ResourceTreeDelta {
  return {
    putNodes: Object.fromEntries(
      Object.entries(delta.putNodes).map(([id, node]) => [id, cloneResourceTreeNode(node)]),
    ),
    deleteNodeIds: [...delta.deleteNodeIds],
    setChildren: delta.setChildren.map((item) => ({
      parentId: item.parentId,
      childIds: [...item.childIds],
    })),
  };
}

function buildWorktreeTreeSnapshot(
  revision: number,
  manuscript: ManuscriptTreeSnapshot,
  resources: ResourceTreeSnapshot,
): WorktreeTreeSnapshot {
  return {
    revision,
    manuscript: cloneManuscriptTreeSnapshot(manuscript),
    resources: cloneResourceTreeSnapshot(resources),
  };
}

function hasManuscriptDelta(delta: ManuscriptTreeDelta | undefined): delta is ManuscriptTreeDelta {
  return (
    delta !== undefined &&
    (Object.keys(delta.putNodes).length > 0 ||
      delta.deleteNodeIds.length > 0 ||
      delta.setChildren.length > 0)
  );
}

function hasResourceDelta(delta: ResourceTreeDelta | undefined): delta is ResourceTreeDelta {
  return (
    delta !== undefined &&
    (Object.keys(delta.putNodes).length > 0 ||
      delta.deleteNodeIds.length > 0 ||
      delta.setChildren.length > 0)
  );
}

function normalizeResourceNodeName(name: string): string {
  const normalized = normalizeResourceNameInput(name);
  if (normalized === "") {
    throw new Error("Name must not be empty.");
  }
  assertValidResourceRelativePath(normalized);
  if (normalized.includes("/")) {
    throw new Error("Name must not contain '/'.");
  }
  return normalized;
}

function resourceDepth(path: string): number {
  return path === "" ? 0 : path.split("/").length - 1;
}

function sortResourceNodeRecords(nodes: ResourceTreeNode[]): ResourceTreeNode[] {
  return [...nodes].sort((left, right) => {
    if (left.type === right.type) {
      return left.name.localeCompare(right.name);
    }
    return left.type === "folder" ? -1 : 1;
  });
}

function readOutlineFromWorktree(worktree: VirtualWorktree): ManuscriptOutline {
  if (!worktree.exists(MANUSCRIPT_OUTLINE_PATH)) {
    return createEmptyOutline();
  }
  const stat = worktree.stat(MANUSCRIPT_OUTLINE_PATH);
  if (stat?.kind !== "blob") {
    throw new Error("Manuscript outline path is not a file.");
  }
  return parseOutline(worktree.readFile(MANUSCRIPT_OUTLINE_PATH).toString("utf-8"));
}

function writeOutlineToWorktree(worktree: VirtualWorktree, outline: ManuscriptOutline): void {
  ensureManuscriptStorage(worktree);
  const validated = validateOutline(cloneOutline(outline));
  worktree.writeFile(
    MANUSCRIPT_OUTLINE_PATH,
    Buffer.from(`${JSON.stringify(validated, null, 2)}\n`, "utf-8"),
  );
}

function readOutlineFromBase(objects: ObjectDatabase, baseTree: SHA1): ManuscriptOutline {
  const content = readTextFromTree(objects, baseTree, MANUSCRIPT_OUTLINE_PATH);
  return content === null ? createEmptyOutline() : parseOutline(content);
}

function buildManuscriptSnapshot(
  outline: ManuscriptOutline,
  readChapter: (id: string) => string,
): ManuscriptSnapshotState {
  const entries = new Map<string, ManuscriptEntry>();
  let order = 0;

  const visit = (parentId: string, parentPath: string, depth: number): void => {
    const parent = outline.nodes[parentId];
    if (parent?.type !== "folder") {
      return;
    }

    parent.children.forEach((childId, index) => {
      const node = outline.nodes[childId];
      if (node === undefined) {
        throw new Error(`Missing manuscript node: ${childId}`);
      }
      const displayPath = parentPath === "" ? node.title : `${parentPath}/${node.title}`;
      const entry: ManuscriptEntry = {
        id: node.id,
        type: node.type,
        title: node.title,
        parentId,
        index,
        depth,
        displayPath,
        order,
        childIds: node.type === "folder" ? [...node.children] : [],
        content: node.type === "chapter" ? readChapter(node.id) : "",
      };
      entries.set(node.id, entry);
      order += 1;

      if (node.type === "folder") {
        visit(node.id, displayPath, depth + 1);
      }
    });
  };

  visit(outline.rootId, "", 0);

  return { outline, entries };
}

function buildBaseManuscriptSnapshot(
  objects: ObjectDatabase,
  baseTree: SHA1,
): ManuscriptSnapshotState {
  const outline = readOutlineFromBase(objects, baseTree);
  return buildManuscriptSnapshot(
    outline,
    (id) => readTextFromTree(objects, baseTree, chapterBodyPath(id)) ?? "",
  );
}

function buildCurrentManuscriptSnapshot(worktree: VirtualWorktree): ManuscriptSnapshotState {
  const outline = readOutlineFromWorktree(worktree);
  return buildManuscriptSnapshot(outline, (id) =>
    worktree.exists(chapterBodyPath(id))
      ? worktree.readFile(chapterBodyPath(id)).toString("utf-8")
      : "",
  );
}

function buildBaseResourceSnapshot(objects: ObjectDatabase, baseTree: SHA1): ResourceSnapshotState {
  const entries = new Map<string, ResourceEntry>();
  let order = 0;

  for (const snapshotEntry of readTreeSnapshot(objects, baseTree)) {
    const { path, object } = snapshotEntry;
    if (!path.startsWith(`${RESOURCES_DIR}/`)) {
      continue;
    }
    const relativePath = path.slice(RESOURCES_DIR.length + 1);
    if (relativePath === "") {
      continue;
    }
    entries.set(relativePath, {
      path: relativePath,
      type: object.kind === "tree" ? "folder" : "file",
      name: resourceBaseName(relativePath),
      parentPath: resourceParentPath(relativePath),
      depth: resourceDepth(relativePath),
      displayPath: relativePath,
      order,
      content:
        object.kind === "blob"
          ? (readTextFromTree(objects, baseTree, joinWorktreeChild(RESOURCES_DIR, relativePath)) ??
            "")
          : "",
      hash: object.hash,
    });
    order += 1;
  }

  return { entries };
}

function buildCurrentResourceSnapshot(worktree: VirtualWorktree): ResourceSnapshotState {
  const entries = new Map<string, ResourceEntry>();
  let order = 0;

  if (!worktree.exists(RESOURCES_DIR)) {
    return { entries };
  }

  const visit = (resourcePath: string): void => {
    const worktreePath = resourcePath === "" ? RESOURCES_DIR : toWorktreePath(resourcePath);
    const dirEntries = sortWorktreeEntries(
      worktree
        .readdir(worktreePath)
        .filter((entry) => entry.kind === "blob" || entry.kind === "tree"),
    );

    for (const dirEntry of dirEntries) {
      const childPath = resourcePath === "" ? dirEntry.name : `${resourcePath}/${dirEntry.name}`;
      const type = dirEntry.kind === "tree" ? "folder" : "file";
      const content =
        type === "file" ? worktree.readFile(toWorktreePath(childPath)).toString("utf-8") : "";
      entries.set(childPath, {
        path: childPath,
        type,
        name: dirEntry.name,
        parentPath: resourceParentPath(childPath),
        depth: resourceDepth(childPath),
        displayPath: childPath,
        order,
        content,
        hash: type === "file" ? sha1Text(content) : sha1Text(`folder:${childPath}`),
      });
      order += 1;

      if (type === "folder") {
        visit(childPath);
      }
    }
  };

  visit("");

  return { entries };
}

function ensureChapterBodiesExist(worktree: VirtualWorktree, outline: ManuscriptOutline): void {
  for (const node of Object.values(outline.nodes)) {
    if (node.type !== "chapter") {
      continue;
    }
    const stat = worktree.stat(chapterBodyPath(node.id));
    if (stat?.kind !== "blob") {
      throw new Error(`Manuscript chapter body is missing: ${node.id}`);
    }
  }
}

function verifyResourceTree(worktree: VirtualWorktree): void {
  if (!worktree.exists(RESOURCES_DIR)) {
    return;
  }

  const visit = (worktreePath: string): void => {
    const stat = worktree.stat(worktreePath);
    if (stat?.kind !== "tree") {
      throw new Error(`Resource path is not a folder: ${worktreePath}`);
    }
    for (const entry of worktree.readdir(worktreePath)) {
      const childPath = joinWorktreeChild(worktreePath, entry.name);
      if (entry.kind === "tree") {
        visit(childPath);
        continue;
      }
      if (entry.kind !== "blob") {
        throw new Error(`Unsupported resource entry kind: ${entry.kind}`);
      }
      const childStat = worktree.stat(childPath);
      if (childStat?.kind !== "blob") {
        throw new Error(`Resource file is not readable: ${childPath}`);
      }
    }
  };

  visit(RESOURCES_DIR);
}

function manuscriptTreeFromOutline(outline: ManuscriptOutline): ManuscriptTreeSnapshot {
  const nodes: Record<string, ManuscriptTreeNode> = {};

  const visit = (id: string, parentId: string | null): void => {
    const node = outline.nodes[id];
    if (node === undefined) {
      throw new Error(`Missing manuscript node: ${id}`);
    }
    nodes[id] = {
      id,
      type: node.type,
      title: node.title,
      parentId,
      childIds: node.type === "folder" ? [...node.children] : [],
    };
    if (node.type === "folder") {
      for (const childId of node.children) {
        visit(childId, id);
      }
    }
  };

  visit(outline.rootId, null);

  return {
    rootId: outline.rootId,
    nodes,
  };
}

function manuscriptTreeToOutline(snapshot: ManuscriptTreeSnapshot): ManuscriptOutline {
  const nodes: Record<string, ManuscriptNode> = {};
  for (const [id, node] of Object.entries(snapshot.nodes)) {
    if (node.type === "folder") {
      nodes[id] = {
        id,
        type: "folder",
        title: node.title,
        children: [...node.childIds],
      };
      continue;
    }
    nodes[id] = {
      id,
      type: "chapter",
      title: node.title,
    };
  }
  return validateOutline({
    version: 1,
    rootId: snapshot.rootId,
    nodes,
  });
}

function sortWorktreeEntries(
  entries: Array<{ name: string; kind: string }>,
): Array<{ name: string; kind: string }> {
  return [...entries].sort((left, right) => {
    if (left.kind === right.kind) {
      return left.name.localeCompare(right.name);
    }
    return left.kind === "tree" ? -1 : 1;
  });
}

export class WorktreeSession {
  readonly #worktree: VirtualWorktree;
  readonly #objects: ObjectDatabase;
  readonly #repo: Repository;
  readonly #branchName: string;
  readonly #scmPublisher = new RpcStreamPublisher<ScmSnapshot>();
  readonly #treePublisher = new RpcStreamPublisher<WorktreeTreeEvent>();
  #revision = 0;
  #warning: string | null = null;
  #manuscriptTree: ManuscriptTreeSnapshot;
  #resourceTree: ResourceTreeSnapshot;
  readonly #resourcePathById = new Map<string, string>();
  readonly #resourceIdByPath = new Map<string, string>();

  constructor(
    worktree: VirtualWorktree,
    objects: ObjectDatabase,
    repo: Repository,
    branchName: string,
    status: ExistingWorktreeStatus,
  ) {
    this.#worktree = worktree;
    this.#objects = objects;
    this.#repo = repo;
    this.#branchName = branchName;
    this.#hydrateOrReset(status);
    this.#manuscriptTree = manuscriptTreeFromOutline(readOutlineFromWorktree(this.#worktree));
    this.#resourceTree = this.#buildResourceTreeFromWorktree();
  }

  subscribeScmSnapshot(): ReadableStream<ScmSnapshot> {
    return this.#scmPublisher.subscribe({
      getInitialValue: () => this.#computeDetailedSnapshot().snapshot,
    });
  }

  subscribeTree(): ReadableStream<WorktreeTreeEvent> {
    return this.#treePublisher.subscribe({
      getInitialValue: () => ({
        kind: "snapshot",
        snapshot: buildWorktreeTreeSnapshot(
          this.#revision,
          this.#manuscriptTree,
          this.#resourceTree,
        ),
      }),
    });
  }

  createManuscriptFolder(parentId: string, title: string, index?: number): WorktreeNodeIdResult {
    const { nodeId, delta } = this.#createManuscriptFolder(parentId, title, index);
    this.#commitMutation({ manuscript: delta });
    return { nodeId };
  }

  createManuscriptChapter(parentId: string, title: string, index?: number): WorktreeNodeIdResult {
    const { nodeId, delta } = this.#createManuscriptChapter(parentId, title, index);
    this.#commitMutation({ manuscript: delta });
    return { nodeId };
  }

  renameManuscriptNode(id: string, title: string): void {
    this.#commitMutation({ manuscript: this.#renameManuscriptNode(id, title) });
  }

  moveManuscriptNode(id: string, targetParentId: string, index?: number): void {
    this.#commitMutation({ manuscript: this.#moveManuscriptNode(id, targetParentId, index) });
  }

  deleteManuscriptNode(id: string): void {
    this.#commitMutation({ manuscript: this.#deleteManuscriptNode(id) });
  }

  readChapter(id: string): string {
    const node = this.#requireManuscriptNode(id);
    if (node.type !== "chapter") {
      throw new Error(`Manuscript node is not a chapter: ${id}`);
    }
    const path = chapterBodyPath(id);
    const stat = this.#worktree.stat(path);
    if (stat === null || stat.kind !== "blob") {
      throw new Error(`Manuscript chapter body is missing: ${id}`);
    }
    return this.#worktree.readFile(path).toString("utf-8");
  }

  writeChapter(id: string, content: string): void {
    const node = this.#requireManuscriptNode(id);
    if (node.type !== "chapter") {
      throw new Error(`Manuscript node is not a chapter: ${id}`);
    }
    ensureManuscriptStorage(this.#worktree);
    this.#worktree.writeFile(chapterBodyPath(id), Buffer.from(content, "utf-8"));
    this.#commitMutation({});
  }

  createResourceFile(parentId: string, name: string): WorktreeNodeIdResult {
    const { nodeId, delta } = this.#createResourceFile(parentId, name);
    this.#commitMutation({ resources: delta });
    return { nodeId };
  }

  createResourceFolder(parentId: string, name: string): WorktreeNodeIdResult {
    const { nodeId, delta } = this.#createResourceFolder(parentId, name);
    this.#commitMutation({ resources: delta });
    return { nodeId };
  }

  renameResourceNode(id: string, name: string): void {
    this.#commitMutation({ resources: this.#renameResourceNode(id, name) });
  }

  moveResourceNode(id: string, targetParentId: string): void {
    this.#commitMutation({ resources: this.#moveResourceNode(id, targetParentId) });
  }

  deleteResourceNode(id: string): void {
    this.#commitMutation({ resources: this.#deleteResourceNode(id) });
  }

  readResourceFile(id: string): string {
    const node = this.#requireResourceNode(id);
    if (node.type !== "file") {
      throw new Error(`Resource node is not a file: ${id}`);
    }
    return this.#worktree.readFile(toWorktreePath(this.#requireResourcePath(id))).toString("utf-8");
  }

  writeResourceFile(id: string, content: string): void {
    const node = this.#requireResourceNode(id);
    if (node.type !== "file") {
      throw new Error(`Resource node is not a file: ${id}`);
    }
    this.#worktree.writeFile(
      toWorktreePath(this.#requireResourcePath(id)),
      Buffer.from(content, "utf-8"),
    );
    this.#commitMutation({});
  }

  revertScmChange(changeId: string): ScmSnapshot {
    const detailed = this.#computeDetailedSnapshot();
    const handler = detailed.changeHandlers.get(changeId);
    if (!handler) {
      throw new Error(`Unknown SCM change: ${changeId}`);
    }
    handler();
    return this.#currentScmSnapshot();
  }

  commitScm(message: string, author: { name: string; email: string }): ScmSnapshot {
    const tree = this.#worktree.writeTree();
    const parentCommit = this.#repo.readBranch(this.#branchName);
    const parents: SHA1[] = parentCommit !== null ? [parentCommit] : [];
    const now = Math.floor(Date.now() / 1000);
    const gitAuthor = { name: author.name, email: author.email, timestamp: now, timezone: "+0000" };

    const commitHash = this.#repo.createCommit(tree, parents, message, gitAuthor);
    this.#repo.updateRef(`refs/heads/${this.#branchName}`, commitHash);
    this.#worktree.reset(tree);
    this.#commitMutation({});
    return this.#currentScmSnapshot();
  }

  #currentScmSnapshot(): ScmSnapshot {
    return this.#computeDetailedSnapshot().snapshot;
  }

  #commitMutation(mutation: TreeMutation): void {
    this.#warning = null;
    const fromRevision = this.#revision;
    this.#revision += 1;
    if (mutation.forceSnapshot) {
      this.#treePublisher.emit({
        kind: "snapshot",
        snapshot: buildWorktreeTreeSnapshot(
          this.#revision,
          this.#manuscriptTree,
          this.#resourceTree,
        ),
      });
    } else {
      const event: WorktreeTreeEvent = {
        kind: "delta",
        fromRevision,
        toRevision: this.#revision,
        ...(hasManuscriptDelta(mutation.manuscript)
          ? { manuscript: cloneManuscriptTreeDelta(mutation.manuscript) }
          : {}),
        ...(hasResourceDelta(mutation.resources)
          ? { resources: cloneResourceTreeDelta(mutation.resources) }
          : {}),
      };
      if ("manuscript" in event || "resources" in event) {
        this.#treePublisher.emit(event);
      }
    }
    this.#scmPublisher.emit(this.#computeDetailedSnapshot().snapshot);
  }

  #hydrateOrReset(status: ExistingWorktreeStatus): void {
    if (!status.hadExistingDraft) {
      ensureManuscriptStorage(this.#worktree);
      ensureResourcesDirectory(this.#worktree);
      if (!this.#worktree.exists(MANUSCRIPT_OUTLINE_PATH)) {
        writeOutlineToWorktree(this.#worktree, createEmptyOutline());
      }
      return;
    }

    try {
      if (this.#worktree.exists(MANUSCRIPT_OUTLINE_PATH)) {
        const outline = readOutlineFromWorktree(this.#worktree);
        ensureChapterBodiesExist(this.#worktree, outline);
      }
      verifyResourceTree(this.#worktree);
    } catch (error) {
      this.#worktree.reset(this.#worktree.baseTree);
      this.#warning =
        error instanceof Error
          ? `检测到损坏草稿，已按分支基线重建：${error.message}`
          : "检测到损坏草稿，已按分支基线重建。";
      this.#revision += 1;
    }

    ensureManuscriptStorage(this.#worktree);
    ensureResourcesDirectory(this.#worktree);
    if (!this.#worktree.exists(MANUSCRIPT_OUTLINE_PATH)) {
      writeOutlineToWorktree(this.#worktree, createEmptyOutline());
    }
  }

  #buildResourceTreeFromWorktree(): ResourceTreeSnapshot {
    ensureResourcesDirectory(this.#worktree);
    this.#resourcePathById.clear();
    this.#resourceIdByPath.clear();

    const nodes: Record<string, ResourceTreeNode> = {
      [RESOURCE_ROOT_ID]: {
        id: RESOURCE_ROOT_ID,
        type: "folder",
        name: "",
        parentId: null,
        childIds: [],
      },
    };
    this.#resourcePathById.set(RESOURCE_ROOT_ID, "");
    this.#resourceIdByPath.set("", RESOURCE_ROOT_ID);

    const visit = (path: string, parentId: string): void => {
      const worktreePath = path === "" ? RESOURCES_DIR : toWorktreePath(path);
      const entries = sortWorktreeEntries(
        this.#worktree
          .readdir(worktreePath)
          .filter((entry) => entry.kind === "blob" || entry.kind === "tree"),
      );

      const childIds: string[] = [];
      for (const entry of entries) {
        const childPath = path === "" ? entry.name : `${path}/${entry.name}`;
        const childId = this.#createResourceId();
        const childNode: ResourceTreeNode = {
          id: childId,
          type: entry.kind === "tree" ? "folder" : "file",
          name: entry.name,
          parentId,
          childIds: [],
        };
        nodes[childId] = childNode;
        this.#resourcePathById.set(childId, childPath);
        this.#resourceIdByPath.set(childPath, childId);
        childIds.push(childId);
        if (childNode.type === "folder") {
          visit(childPath, childId);
        }
      }

      nodes[parentId]!.childIds = childIds;
    };

    visit("", RESOURCE_ROOT_ID);

    return {
      rootId: RESOURCE_ROOT_ID,
      nodes,
    };
  }

  #createManuscriptFolder(
    parentId: string,
    title: string,
    index?: number,
  ): { nodeId: string; delta: ManuscriptTreeDelta } {
    const parent = this.#requireManuscriptFolder(parentId);
    const nodeId = this.#createUniqueManuscriptId();
    const folder: ManuscriptTreeNode = {
      id: nodeId,
      type: "folder",
      title: normalizeManuscriptTitle(title),
      parentId: parent.id,
      childIds: [],
    };
    this.#manuscriptTree.nodes[nodeId] = folder;
    parent.childIds.splice(clampChildIndex(index, parent.childIds.length), 0, nodeId);
    this.#writeCurrentManuscriptTree();
    return {
      nodeId,
      delta: {
        putNodes: {
          [nodeId]: cloneManuscriptTreeNode(folder),
        },
        deleteNodeIds: [],
        setChildren: [this.#manuscriptChildrenPatch(parent.id)],
      },
    };
  }

  #createManuscriptChapter(
    parentId: string,
    title: string,
    index?: number,
  ): { nodeId: string; delta: ManuscriptTreeDelta } {
    const parent = this.#requireManuscriptFolder(parentId);
    const nodeId = this.#createUniqueManuscriptId();
    const chapter: ManuscriptTreeNode = {
      id: nodeId,
      type: "chapter",
      title: normalizeManuscriptTitle(title),
      parentId: parent.id,
      childIds: [],
    };
    ensureManuscriptStorage(this.#worktree);
    this.#worktree.writeFile(chapterBodyPath(nodeId), Buffer.from("", "utf-8"));
    this.#manuscriptTree.nodes[nodeId] = chapter;
    parent.childIds.splice(clampChildIndex(index, parent.childIds.length), 0, nodeId);
    this.#writeCurrentManuscriptTree();
    return {
      nodeId,
      delta: {
        putNodes: {
          [nodeId]: cloneManuscriptTreeNode(chapter),
        },
        deleteNodeIds: [],
        setChildren: [this.#manuscriptChildrenPatch(parent.id)],
      },
    };
  }

  #renameManuscriptNode(id: string, title: string): ManuscriptTreeDelta {
    const node = this.#requireManuscriptNode(id);
    node.title = normalizeManuscriptTitle(title);
    this.#writeCurrentManuscriptTree();
    return {
      putNodes: {
        [id]: cloneManuscriptTreeNode(node),
      },
      deleteNodeIds: [],
      setChildren: [],
    };
  }

  #moveManuscriptNode(id: string, targetParentId: string, index?: number): ManuscriptTreeDelta {
    if (id === MANUSCRIPT_ROOT_ID) {
      throw new Error("Cannot move the manuscript root.");
    }
    const node = this.#requireManuscriptNode(id);
    const sourceParentId = node.parentId;
    if (sourceParentId === null) {
      throw new Error(`Manuscript node has no parent: ${id}`);
    }
    const sourceParent = this.#requireManuscriptFolder(sourceParentId);
    const targetParent = this.#requireManuscriptFolder(targetParentId);
    if (targetParentId === id || this.#isManuscriptDescendant(id, targetParentId)) {
      throw new Error("Cannot move a manuscript node into itself or its descendants.");
    }

    const previousIndex = sourceParent.childIds.indexOf(id);
    if (previousIndex === -1) {
      throw new Error(`Manuscript node is missing from parent: ${id}`);
    }
    sourceParent.childIds.splice(previousIndex, 1);
    const insertionIndex =
      sourceParent.id === targetParent.id && index !== undefined && index > previousIndex
        ? clampChildIndex(index - 1, targetParent.childIds.length)
        : clampChildIndex(index, targetParent.childIds.length);
    targetParent.childIds.splice(insertionIndex, 0, id);
    node.parentId = targetParent.id;
    this.#writeCurrentManuscriptTree();

    const setChildren: TreeChildrenPatch[] =
      sourceParent.id === targetParent.id
        ? [this.#manuscriptChildrenPatch(sourceParent.id)]
        : [
            this.#manuscriptChildrenPatch(sourceParent.id),
            this.#manuscriptChildrenPatch(targetParent.id),
          ];

    return {
      putNodes: node.parentId === sourceParentId ? {} : { [id]: cloneManuscriptTreeNode(node) },
      deleteNodeIds: [],
      setChildren,
    };
  }

  #deleteManuscriptNode(id: string): ManuscriptTreeDelta {
    if (id === MANUSCRIPT_ROOT_ID) {
      throw new Error("Cannot delete the manuscript root.");
    }
    const node = this.#requireManuscriptNode(id);
    const parentId = node.parentId;
    if (parentId === null) {
      throw new Error(`Manuscript node has no parent: ${id}`);
    }
    const parent = this.#requireManuscriptFolder(parentId);
    const deleteIds = this.#collectManuscriptSubtreeIds(id);
    parent.childIds = parent.childIds.filter((childId) => childId !== id);
    for (const deleteId of deleteIds) {
      const deleteNode = this.#manuscriptTree.nodes[deleteId];
      if (deleteNode?.type === "chapter") {
        this.#worktree.delete(chapterBodyPath(deleteId), { force: true });
      }
      delete this.#manuscriptTree.nodes[deleteId];
    }
    this.#writeCurrentManuscriptTree();
    return {
      putNodes: {},
      deleteNodeIds: deleteIds,
      setChildren: [this.#manuscriptChildrenPatch(parentId)],
    };
  }

  #restoreManuscriptSubtreeFromBase(
    baseManuscript: ManuscriptSnapshotState,
    id: string,
  ): ManuscriptTreeDelta {
    const baseNode = baseManuscript.outline.nodes[id];
    if (baseNode === undefined) {
      throw new Error(`Base manuscript node does not exist: ${id}`);
    }
    const parentId = findParentId(baseManuscript.outline, id) ?? baseManuscript.outline.rootId;
    const baseParent = baseManuscript.outline.nodes[parentId];
    const currentParent = this.#requireManuscriptFolder(parentId);
    if (baseParent?.type !== "folder") {
      throw new Error("Base manuscript parent must be a folder.");
    }

    const subtreeIds = [id, ...collectDescendantIds(baseManuscript.outline, id)];
    const putNodes: Record<string, ManuscriptTreeNode> = {};
    for (const subtreeId of subtreeIds) {
      const subtreeNode = baseManuscript.outline.nodes[subtreeId];
      if (subtreeNode === undefined) {
        continue;
      }
      const normalizedNode: ManuscriptTreeNode = {
        id: subtreeId,
        type: subtreeNode.type,
        title: subtreeNode.title,
        parentId: findParentId(baseManuscript.outline, subtreeId),
        childIds: subtreeNode.type === "folder" ? [...subtreeNode.children] : [],
      };
      this.#manuscriptTree.nodes[subtreeId] = normalizedNode;
      putNodes[subtreeId] = cloneManuscriptTreeNode(normalizedNode);
      if (subtreeNode.type === "chapter") {
        ensureManuscriptStorage(this.#worktree);
        this.#worktree.writeFile(
          chapterBodyPath(subtreeId),
          Buffer.from(baseManuscript.entries.get(subtreeId)?.content ?? "", "utf-8"),
        );
      }
    }

    const baseIndex = baseParent.children.indexOf(id);
    currentParent.childIds.splice(clampChildIndex(baseIndex, currentParent.childIds.length), 0, id);
    this.#writeCurrentManuscriptTree();

    return {
      putNodes,
      deleteNodeIds: [],
      setChildren: [this.#manuscriptChildrenPatch(currentParent.id)],
    };
  }

  #createResourceFile(
    parentId: string,
    name: string,
  ): { nodeId: string; delta: ResourceTreeDelta } {
    const parent = this.#requireResourceFolder(parentId);
    const normalizedName = normalizeResourceNodeName(name);
    this.#assertResourceSiblingNameAvailable(parent.id, normalizedName);
    const path = this.#joinResourcePath(parent.id, normalizedName);
    const nodeId = this.#createResourceId();
    const node: ResourceTreeNode = {
      id: nodeId,
      type: "file",
      name: normalizedName,
      parentId: parent.id,
      childIds: [],
    };
    this.#worktree.writeFile(toWorktreePath(path), Buffer.from("", "utf-8"));
    this.#resourceTree.nodes[nodeId] = node;
    this.#resourcePathById.set(nodeId, path);
    this.#resourceIdByPath.set(path, nodeId);
    parent.childIds.push(nodeId);
    this.#sortResourceChildren(parent.id);
    return {
      nodeId,
      delta: {
        putNodes: { [nodeId]: cloneResourceTreeNode(node) },
        deleteNodeIds: [],
        setChildren: [this.#resourceChildrenPatch(parent.id)],
      },
    };
  }

  #createResourceFolder(
    parentId: string,
    name: string,
  ): { nodeId: string; delta: ResourceTreeDelta } {
    const parent = this.#requireResourceFolder(parentId);
    const normalizedName = normalizeResourceNodeName(name);
    this.#assertResourceSiblingNameAvailable(parent.id, normalizedName);
    const path = this.#joinResourcePath(parent.id, normalizedName);
    const nodeId = this.#createResourceId();
    const node: ResourceTreeNode = {
      id: nodeId,
      type: "folder",
      name: normalizedName,
      parentId: parent.id,
      childIds: [],
    };
    this.#worktree.mkdir(toWorktreePath(path), { recursive: true });
    this.#resourceTree.nodes[nodeId] = node;
    this.#resourcePathById.set(nodeId, path);
    this.#resourceIdByPath.set(path, nodeId);
    parent.childIds.push(nodeId);
    this.#sortResourceChildren(parent.id);
    return {
      nodeId,
      delta: {
        putNodes: { [nodeId]: cloneResourceTreeNode(node) },
        deleteNodeIds: [],
        setChildren: [this.#resourceChildrenPatch(parent.id)],
      },
    };
  }

  #renameResourceNode(id: string, name: string): ResourceTreeDelta {
    if (id === RESOURCE_ROOT_ID) {
      throw new Error("Cannot rename the resource library root.");
    }
    const node = this.#requireResourceNode(id);
    const normalizedName = normalizeResourceNodeName(name);
    const parentId = node.parentId;
    if (parentId === null) {
      throw new Error(`Resource node has no parent: ${id}`);
    }
    this.#assertResourceSiblingNameAvailable(parentId, normalizedName, id);
    const previousPath = this.#requireResourcePath(id);
    const nextPath = this.#joinResourcePath(parentId, normalizedName);
    this.#worktree.move(toWorktreePath(previousPath), toWorktreePath(nextPath));
    node.name = normalizedName;
    this.#reindexResourceSubtreePaths(id);
    this.#sortResourceChildren(parentId);
    return {
      putNodes: { [id]: cloneResourceTreeNode(node) },
      deleteNodeIds: [],
      setChildren: [this.#resourceChildrenPatch(parentId)],
    };
  }

  #moveResourceNode(id: string, targetParentId: string): ResourceTreeDelta {
    if (id === RESOURCE_ROOT_ID) {
      throw new Error("Cannot move the resource library root.");
    }
    const node = this.#requireResourceNode(id);
    const sourceParentId = node.parentId;
    if (sourceParentId === null) {
      throw new Error(`Resource node has no parent: ${id}`);
    }
    const targetParent = this.#requireResourceFolder(targetParentId);
    if (
      node.type === "folder" &&
      (targetParentId === id || this.#isResourceDescendant(id, targetParentId))
    ) {
      throw new Error("Cannot move a folder into itself or one of its descendants.");
    }
    if (targetParentId === sourceParentId) {
      throw new Error("Node is already under the target folder.");
    }
    this.#assertResourceSiblingNameAvailable(targetParentId, node.name);

    const sourceParent = this.#requireResourceFolder(sourceParentId);
    sourceParent.childIds = sourceParent.childIds.filter((childId) => childId !== id);
    targetParent.childIds.push(id);
    node.parentId = targetParent.id;

    const previousPath = this.#requireResourcePath(id);
    const nextPath = this.#joinResourcePath(targetParent.id, node.name);
    this.#worktree.move(toWorktreePath(previousPath), toWorktreePath(nextPath));
    this.#reindexResourceSubtreePaths(id);
    this.#sortResourceChildren(sourceParent.id);
    this.#sortResourceChildren(targetParent.id);

    return {
      putNodes: { [id]: cloneResourceTreeNode(node) },
      deleteNodeIds: [],
      setChildren: [
        this.#resourceChildrenPatch(sourceParent.id),
        this.#resourceChildrenPatch(targetParent.id),
      ],
    };
  }

  #deleteResourceNode(id: string): ResourceTreeDelta {
    if (id === RESOURCE_ROOT_ID) {
      throw new Error("Cannot delete the resource library root.");
    }
    const node = this.#requireResourceNode(id);
    const parentId = node.parentId;
    if (parentId === null) {
      throw new Error(`Resource node has no parent: ${id}`);
    }
    const deleteIds = this.#collectResourceSubtreeIds(id);
    const parent = this.#requireResourceFolder(parentId);
    parent.childIds = parent.childIds.filter((childId) => childId !== id);
    this.#deleteWorktreeResourcePath(this.#requireResourcePath(id));
    for (const deleteId of deleteIds) {
      const path = this.#resourcePathById.get(deleteId);
      if (path !== undefined) {
        this.#resourceIdByPath.delete(path);
      }
      this.#resourcePathById.delete(deleteId);
      delete this.#resourceTree.nodes[deleteId];
    }
    return {
      putNodes: {},
      deleteNodeIds: deleteIds,
      setChildren: [this.#resourceChildrenPatch(parentId)],
    };
  }

  #restoreResourcePathFromBase(path: string, type: "file" | "folder"): ResourceTreeDelta {
    const parentPath = resourceParentPath(path);
    const parentId = this.#resourceIdByPath.get(parentPath);
    if (parentId === undefined) {
      throw new Error(`Resource parent does not exist: ${parentPath}`);
    }
    this.#worktree.restore(toWorktreePath(path), {
      force: true,
      recursive: type === "folder",
    });
    const restoreResult = this.#materializeRestoredResourceSubtree(path, parentId);
    this.#sortResourceChildren(parentId);
    return {
      putNodes: restoreResult.putNodes,
      deleteNodeIds: [],
      setChildren: [this.#resourceChildrenPatch(parentId)],
    };
  }

  #materializeRestoredResourceSubtree(
    path: string,
    parentId: string,
  ): { rootId: string; putNodes: Record<string, ResourceTreeNode> } {
    const stat = this.#worktree.stat(toWorktreePath(path));
    if (stat === null) {
      throw new Error(`Restored resource does not exist: ${path}`);
    }
    const putNodes: Record<string, ResourceTreeNode> = {};

    const visit = (currentPath: string, currentParentId: string): string => {
      const currentStat = this.#worktree.stat(toWorktreePath(currentPath));
      if (currentStat === null) {
        throw new Error(`Resource does not exist: ${currentPath}`);
      }
      const nodeId = this.#createResourceId();
      const node: ResourceTreeNode = {
        id: nodeId,
        type: currentStat.kind === "tree" ? "folder" : "file",
        name: resourceBaseName(currentPath),
        parentId: currentParentId,
        childIds: [],
      };
      this.#resourceTree.nodes[nodeId] = node;
      this.#resourcePathById.set(nodeId, currentPath);
      this.#resourceIdByPath.set(currentPath, nodeId);
      putNodes[nodeId] = cloneResourceTreeNode(node);

      if (node.type === "folder") {
        const entries = sortWorktreeEntries(
          this.#worktree
            .readdir(toWorktreePath(currentPath))
            .filter((entry) => entry.kind === "blob" || entry.kind === "tree"),
        );
        const childIds = entries.map((entry) =>
          visit(currentPath === "" ? entry.name : `${currentPath}/${entry.name}`, nodeId),
        );
        node.childIds = childIds;
        putNodes[nodeId] = cloneResourceTreeNode(node);
      }

      return nodeId;
    };

    const rootId = visit(path, parentId);
    this.#requireResourceFolder(parentId).childIds.push(rootId);

    return { rootId, putNodes };
  }

  #writeCurrentManuscriptTree(): void {
    writeOutlineToWorktree(this.#worktree, manuscriptTreeToOutline(this.#manuscriptTree));
  }

  #requireManuscriptNode(id: string): ManuscriptTreeNode {
    const node = this.#manuscriptTree.nodes[id];
    if (node === undefined) {
      throw new Error(`Manuscript node does not exist: ${id}`);
    }
    return node;
  }

  #requireManuscriptFolder(id: string): ManuscriptTreeNode & { type: "folder" } {
    const node = this.#requireManuscriptNode(id);
    if (node.type !== "folder") {
      throw new Error(`Manuscript node is not a folder: ${id}`);
    }
    return node as ManuscriptTreeNode & { type: "folder" };
  }

  #collectManuscriptSubtreeIds(id: string): string[] {
    const node = this.#requireManuscriptNode(id);
    if (node.type === "chapter") {
      return [id];
    }
    return [id, ...node.childIds.flatMap((childId) => this.#collectManuscriptSubtreeIds(childId))];
  }

  #isManuscriptDescendant(ancestorId: string, candidateId: string): boolean {
    let currentId = this.#requireManuscriptNode(candidateId).parentId;
    while (currentId !== null) {
      if (currentId === ancestorId) {
        return true;
      }
      currentId = this.#requireManuscriptNode(currentId).parentId;
    }
    return false;
  }

  #createUniqueManuscriptId(): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const id = nanoid(MANUSCRIPT_ID_SIZE);
      if (this.#manuscriptTree.nodes[id] === undefined) {
        return id;
      }
    }
    throw new Error("Failed to create a unique manuscript node id.");
  }

  #manuscriptChildrenPatch(parentId: string): TreeChildrenPatch {
    return {
      parentId,
      childIds: [...this.#requireManuscriptFolder(parentId).childIds],
    };
  }

  #requireResourceNode(id: string): ResourceTreeNode {
    const node = this.#resourceTree.nodes[id];
    if (node === undefined) {
      throw new Error(`Resource node does not exist: ${id}`);
    }
    return node;
  }

  #requireResourceFolder(id: string): ResourceTreeNode & { type: "folder" } {
    const node = this.#requireResourceNode(id);
    if (node.type !== "folder") {
      throw new Error(`Resource node is not a folder: ${id}`);
    }
    return node as ResourceTreeNode & { type: "folder" };
  }

  #requireResourcePath(id: string): string {
    const path = this.#resourcePathById.get(id);
    if (path === undefined) {
      throw new Error(`Resource path does not exist: ${id}`);
    }
    return path;
  }

  #joinResourcePath(parentId: string, name: string): string {
    const parentPath = this.#requireResourcePath(parentId);
    return parentPath === "" ? name : `${parentPath}/${name}`;
  }

  #resourceChildrenPatch(parentId: string): TreeChildrenPatch {
    return {
      parentId,
      childIds: [...this.#requireResourceFolder(parentId).childIds],
    };
  }

  #sortResourceChildren(parentId: string): void {
    const parent = this.#requireResourceFolder(parentId);
    const nodes = parent.childIds.map((childId) => this.#requireResourceNode(childId));
    parent.childIds = sortResourceNodeRecords(nodes).map((node) => node.id);
  }

  #assertResourceSiblingNameAvailable(parentId: string, name: string, excludingId?: string): void {
    const parent = this.#requireResourceFolder(parentId);
    const duplicate = parent.childIds.find((childId) => {
      if (childId === excludingId) {
        return false;
      }
      return this.#requireResourceNode(childId).name === name;
    });
    if (duplicate !== undefined) {
      throw new Error(`A resource named "${name}" already exists here.`);
    }
  }

  #collectResourceSubtreeIds(id: string): string[] {
    const node = this.#requireResourceNode(id);
    if (node.type === "file") {
      return [id];
    }
    return [id, ...node.childIds.flatMap((childId) => this.#collectResourceSubtreeIds(childId))];
  }

  #isResourceDescendant(ancestorId: string, candidateId: string): boolean {
    let currentId = this.#requireResourceNode(candidateId).parentId;
    while (currentId !== null) {
      if (currentId === ancestorId) {
        return true;
      }
      currentId = this.#requireResourceNode(currentId).parentId;
    }
    return false;
  }

  #reindexResourceSubtreePaths(id: string): void {
    const visit = (currentId: string): void => {
      const node = this.#requireResourceNode(currentId);
      const parentPath = node.parentId === null ? "" : this.#requireResourcePath(node.parentId);
      const nextPath =
        currentId === RESOURCE_ROOT_ID
          ? ""
          : parentPath === ""
            ? node.name
            : `${parentPath}/${node.name}`;
      const previousPath = this.#resourcePathById.get(currentId);
      if (previousPath !== undefined) {
        this.#resourceIdByPath.delete(previousPath);
      }
      this.#resourcePathById.set(currentId, nextPath);
      this.#resourceIdByPath.set(nextPath, currentId);
      if (node.type === "folder") {
        for (const childId of node.childIds) {
          visit(childId);
        }
      }
    };

    visit(id);
  }

  #createResourceId(): string {
    while (true) {
      const id = `res_${nanoid(RESOURCE_ID_SIZE)}`;
      if (!this.#resourcePathById.has(id)) {
        return id;
      }
    }
  }

  #deleteWorktreeResourcePath(path: string): void {
    const worktreePath = toWorktreePath(path);
    const stat = this.#worktree.stat(worktreePath);
    if (stat?.kind === "tree") {
      for (const entry of this.#worktree.readdir(worktreePath)) {
        const childPath = path === "" ? entry.name : `${path}/${entry.name}`;
        this.#deleteWorktreeResourcePath(childPath);
      }
    }
    this.#worktree.delete(worktreePath, { force: true });
  }

  #computeDetailedSnapshot(): DetailedSnapshot {
    const baseTree = this.#worktree.baseTree;
    const baseManuscript = buildBaseManuscriptSnapshot(this.#objects, baseTree);
    const currentManuscript = buildCurrentManuscriptSnapshot(this.#worktree);
    const baseResources = buildBaseResourceSnapshot(this.#objects, baseTree);
    const currentResources = buildCurrentResourceSnapshot(this.#worktree);

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
        changeHandlers.set(change.id, () => {
          this.#commitMutation({ manuscript: this.#deleteManuscriptNode(id) });
        });
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
        changeHandlers.set(change.id, () => {
          this.#commitMutation({
            manuscript: this.#restoreManuscriptSubtreeFromBase(baseManuscript, id),
          });
        });
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
        changeHandlers.set(change.id, () => {
          this.#commitMutation({ manuscript: this.#renameManuscriptNode(id, previous.title) });
        });
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
        changeHandlers.set(change.id, () => {
          this.#commitMutation({
            manuscript: this.#moveManuscriptNode(id, previous.parentId, previous.index),
          });
        });
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
        changeHandlers.set(change.id, () => {
          this.#commitMutation({
            manuscript: this.#moveManuscriptNode(id, previous.parentId, previous.index),
          });
        });
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
        changeHandlers.set(change.id, () => {
          ensureManuscriptStorage(this.#worktree);
          this.#worktree.writeFile(chapterBodyPath(id), Buffer.from(previous.content, "utf-8"));
          this.#commitMutation({});
        });
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
        changeHandlers.set(change.id, () => {
          const id = this.#resourceIdByPath.get(path);
          if (id === undefined) {
            throw new Error(`Resource does not exist: ${path}`);
          }
          this.#commitMutation({ resources: this.#deleteResourceNode(id) });
        });
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
        changeHandlers.set(change.id, () => {
          this.#commitMutation({
            resources: this.#restoreResourcePathFromBase(path, previous.type),
          });
        });
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
        changeHandlers.set(change.id, () => {
          const id = this.#resourceIdByPath.get(path);
          if (id === undefined) {
            throw new Error(`Resource does not exist: ${path}`);
          }
          this.#worktree.writeFile(toWorktreePath(path), Buffer.from(previous.content, "utf-8"));
          this.#commitMutation({});
        });
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
        revision: this.#revision,
        baseTree,
        hasChanges: manuscriptChanges.length > 0 || resourceChanges.length > 0,
        warning: this.#warning,
        manuscriptChanges: manuscriptChanges.map((item) => item.change),
        resourceChanges: resourceChanges.map((item) => item.change),
      },
      changeHandlers,
    };
  }
}
