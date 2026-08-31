import type {
  ManuscriptFolderNode,
  ManuscriptNode,
  ManuscriptOutline,
} from "@novelevolver/domain/worktree";
import { validateOutline } from "@novelevolver/domain/worktree";
import type { Database } from "@novelevolver/mobile-sqlite";
import type { GitCommit, Repository, SHA1, TreeEntry } from "nano-git";

import { createSettingsId } from "../../../shared/settings/create-id";

const ROOT_ID = "root";
const MANUSCRIPT_DIR = "manuscript";
const MANUSCRIPT_TREE_FILE = "outline.json";
const BODY_DIR = "bodies";
const AUTHOR = { name: "NovelEvolver", email: "app@novel-evolver.local" } as const;

type StoredState = {
  outline: ManuscriptOutline;
  contents: Record<string, string>;
  baseOutline: ManuscriptOutline;
  baseContents: Record<string, string>;
};

function emptyOutline(): ManuscriptOutline {
  return {
    version: 1,
    rootId: ROOT_ID,
    nodes: { [ROOT_ID]: { id: ROOT_ID, type: "folder", title: "手稿", children: [] } },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeTitle(value: string): string {
  const title = value.trim();
  if (
    title === "" ||
    title === "." ||
    title === ".." ||
    title.includes("\0") ||
    title.includes("/") ||
    title.includes("\\")
  ) {
    throw new Error("名称不能为空且不能包含路径分隔符");
  }
  return title;
}

function isDescendant(
  outline: ManuscriptOutline,
  ancestorId: string,
  candidateId: string,
): boolean {
  const ancestor = outline.nodes[ancestorId];
  if (ancestor?.type !== "folder") return false;
  return ancestor.children.some(
    (childId) => childId === candidateId || isDescendant(outline, childId, candidateId),
  );
}
function readBlob(repo: Repository, entry: TreeEntry): string {
  const object = repo.catFile(entry.hash);
  if (object.type !== "blob") throw new Error(`预期 blob，实际为 ${object.type}`);
  return object.content.toString("utf8");
}

function treeEntries(repo: Repository, hash: SHA1): TreeEntry[] {
  const object = repo.catFile(hash);
  if (object.type !== "tree") throw new Error(`预期 tree，实际为 ${object.type}`);
  return object.entries;
}

function findTree(repo: Repository, entries: TreeEntry[], name: string): TreeEntry | null {
  return entries.find((entry) => entry.name === name) ?? null;
}

function loadCommittedState(repo: Repository): {
  outline: ManuscriptOutline;
  contents: Record<string, string>;
} {
  const branch = repo.getCurrentBranch();
  if (branch === null) throw new Error("项目没有可编辑的当前分支");
  const commitHash = repo.readBranch(branch);
  if (commitHash === null) return { outline: emptyOutline(), contents: {} };
  const commit = repo.catFile(commitHash);
  if (commit.type !== "commit") throw new Error("当前分支没有指向有效提交");
  const rootEntries = treeEntries(repo, (commit as GitCommit).tree);
  const manuscriptEntry = findTree(repo, rootEntries, MANUSCRIPT_DIR);
  if (manuscriptEntry === null) return { outline: emptyOutline(), contents: {} };
  const manuscriptEntries = treeEntries(repo, manuscriptEntry.hash);
  const outlineEntry = findTree(repo, manuscriptEntries, MANUSCRIPT_TREE_FILE);
  if (outlineEntry === null) return { outline: emptyOutline(), contents: {} };
  const outline = validateOutline(JSON.parse(readBlob(repo, outlineEntry)));
  const bodiesEntry = findTree(repo, manuscriptEntries, BODY_DIR);
  const contents: Record<string, string> = {};
  if (bodiesEntry !== null) {
    for (const body of treeEntries(repo, bodiesEntry.hash)) {
      const id = body.name.endsWith(".md") ? body.name.slice(0, -3) : body.name;
      contents[id] = readBlob(repo, body);
    }
  }
  return { outline, contents };
}

function parseContents(
  value: unknown,
  outline: ManuscriptOutline,
  field: string,
): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`草稿 ${field} 无效`);
  }
  const contents: Record<string, string> = {};
  for (const [id, content] of Object.entries(value)) {
    if (typeof content !== "string" || outline.nodes[id]?.type !== "chapter") {
      throw new Error(`草稿 ${field} 包含无效章节：${id}`);
    }
    contents[id] = content;
  }
  return contents;
}

function parseStoredState(value: unknown): StoredState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("草稿状态无效");
  }
  const raw = value as Record<string, unknown>;
  const outline = validateOutline(raw.outline);
  const baseOutline = validateOutline(raw.baseOutline);
  return {
    outline,
    contents: parseContents(raw.contents, outline, "正文"),
    baseOutline,
    baseContents: parseContents(raw.baseContents, baseOutline, "基线正文"),
  };
}

function stateFromRows(db: Database): StoredState | null {
  const row = db
    .query<{ value: string }>("SELECT value FROM worktree_meta WHERE key = 'state'")
    .get();
  if (row === null) return null;
  return parseStoredState(JSON.parse(row.value) as unknown);
}

function persist(db: Database, state: StoredState): void {
  db.transaction(() => {
    db.run("CREATE TABLE IF NOT EXISTS worktree_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    db.run(
      "INSERT OR REPLACE INTO worktree_meta (key, value) VALUES (?, ?)",
      "state",
      JSON.stringify(state),
    );
  })();
}

function treeForState(
  repo: Repository,
  outline: ManuscriptOutline,
  contents: Record<string, string>,
): SHA1 {
  const bodyEntries: TreeEntry[] = [];
  for (const node of Object.values(outline.nodes)) {
    if (node.type === "chapter") {
      bodyEntries.push({
        mode: "100644",
        name: `${node.id}.md`,
        hash: repo.writeBlob(Buffer.from(contents[node.id] ?? "", "utf8")),
      });
    }
  }
  const bodyTree = repo.createTree(bodyEntries);
  const outlineHash = repo.writeBlob(Buffer.from(JSON.stringify(outline), "utf8"));
  const manuscriptTree = repo.createTree([
    { mode: "100644", name: MANUSCRIPT_TREE_FILE, hash: outlineHash },
    { mode: "040000", name: BODY_DIR, hash: bodyTree },
  ]);
  const branch = repo.getCurrentBranch();
  const parent = branch === null ? null : repo.readBranch(branch);
  const preservedEntries: TreeEntry[] = [];
  if (parent !== null) {
    const commit = repo.catFile(parent);
    if (commit.type === "commit") {
      preservedEntries.push(
        ...treeEntries(repo, commit.tree).filter((entry) => entry.name !== MANUSCRIPT_DIR),
      );
    }
  }
  preservedEntries.push({ mode: "040000", name: MANUSCRIPT_DIR, hash: manuscriptTree });
  return repo.createTree(preservedEntries);
}

export class WorktreeSession {
  readonly branchName: string;
  #db: Database;
  #repo: Repository;
  #outline: ManuscriptOutline;
  #contents: Record<string, string>;
  #baseOutline: ManuscriptOutline;
  #baseContents: Record<string, string>;
  readonly warning: string | null;

  private constructor(
    db: Database,
    repo: Repository,
    state: StoredState,
    branchName: string,
    warning: string | null,
  ) {
    this.#db = db;
    this.#repo = repo;
    this.#outline = state.outline;
    this.#contents = state.contents;
    this.#baseOutline = state.baseOutline;
    this.#baseContents = state.baseContents;
    this.branchName = branchName;
    this.warning = warning;
  }

  static open(db: Database, repo: Repository): WorktreeSession {
    const branchName = repo.getCurrentBranch();
    if (branchName === null) throw new Error("项目没有可编辑的当前分支");
    let state: StoredState;
    let warning: string | null = null;
    try {
      state =
        stateFromRows(db) ??
        (() => {
          const committed = loadCommittedState(repo);
          return {
            outline: committed.outline,
            contents: committed.contents,
            baseOutline: clone(committed.outline),
            baseContents: { ...committed.contents },
          };
        })();
    } catch (error) {
      const committed = loadCommittedState(repo);
      state = {
        outline: committed.outline,
        contents: committed.contents,
        baseOutline: clone(committed.outline),
        baseContents: { ...committed.contents },
      };
      warning =
        error instanceof Error
          ? `检测到损坏草稿，已按提交基线重建：${error.message}`
          : "检测到损坏草稿，已按提交基线重建。";
    }
    persist(db, state);
    return new WorktreeSession(db, repo, state, branchName, warning);
  }

  get outline(): ManuscriptOutline {
    return clone(this.#outline);
  }
  get hasChanges(): boolean {
    return (
      JSON.stringify(this.#outline) !== JSON.stringify(this.#baseOutline) ||
      JSON.stringify(this.#contents) !== JSON.stringify(this.#baseContents)
    );
  }
  get hasCommit(): boolean {
    return this.#repo.readBranch(this.branchName) !== null;
  }
  readChapter(id: string): string {
    return this.#contents[id] ?? "";
  }

  writeChapter(id: string, content: string): void {
    const node = this.#outline.nodes[id];
    if (node?.type !== "chapter") throw new Error("目标不是章节");
    this.#contents[id] = content;
  }

  createFolder(parentId: string, title: string): string {
    return this.#createNode(parentId, "folder", title);
  }
  createChapter(parentId: string, title: string): string {
    return this.#createNode(parentId, "chapter", title);
  }

  #createNode(parentId: string, type: "folder" | "chapter", title: string): string {
    const parent = this.#outline.nodes[parentId];
    if (parent?.type !== "folder") throw new Error("父节点不是文件夹");
    const id = createSettingsId().slice(0, 10);
    const node: ManuscriptNode =
      type === "folder"
        ? { id, type, title: normalizeTitle(title), children: [] }
        : { id, type, title: normalizeTitle(title) };
    this.#outline.nodes[id] = node;
    parent.children.push(id);
    if (type === "chapter") this.#contents[id] = "";
    return id;
  }

  renameNode(id: string, title: string): void {
    const node = this.#outline.nodes[id];
    if (node === undefined || id === ROOT_ID) throw new Error("节点不存在或不能重命名根节点");
    node.title = normalizeTitle(title);
  }

  deleteNode(id: string): void {
    if (id === ROOT_ID) throw new Error("不能删除 manuscript 根节点");
    const node = this.#outline.nodes[id];
    if (node === undefined) throw new Error("节点不存在");
    const parent = Object.values(this.#outline.nodes).find(
      (candidate): candidate is ManuscriptFolderNode =>
        candidate.type === "folder" && candidate.children.includes(id),
    );
    if (parent === undefined) throw new Error("节点父级不存在");
    parent.children = parent.children.filter((childId) => childId !== id);
    const remove = (nodeId: string) => {
      const child = this.#outline.nodes[nodeId];
      if (child?.type === "folder") child.children.forEach(remove);
      delete this.#outline.nodes[nodeId];
      delete this.#contents[nodeId];
    };
    remove(id);
  }

  moveNode(id: string, targetParentId: string, index: number): void {
    if (id === ROOT_ID) throw new Error("不能移动根节点");
    const node = this.#outline.nodes[id];
    const target = this.#outline.nodes[targetParentId];
    if (node === undefined || target?.type !== "folder") throw new Error("移动目标无效");
    if (targetParentId === id || isDescendant(this.#outline, id, targetParentId))
      throw new Error("不能移动到自身或后代");
    const source = Object.values(this.#outline.nodes).find(
      (candidate): candidate is ManuscriptFolderNode =>
        candidate.type === "folder" && candidate.children.includes(id),
    );
    if (source === undefined) throw new Error("节点父级不存在");
    source.children = source.children.filter((childId) => childId !== id);
    const nextIndex = Math.max(0, Math.min(index, target.children.length));
    target.children.splice(nextIndex, 0, id);
  }

  flush(): void {
    persist(this.#db, {
      outline: this.#outline,
      contents: this.#contents,
      baseOutline: this.#baseOutline,
      baseContents: this.#baseContents,
    });
  }

  commit(message: string): void {
    const trimmed = message.trim();
    if (trimmed === "") throw new Error("提交消息不能为空");
    const tree = treeForState(this.#repo, this.#outline, this.#contents);
    const parent = this.#repo.readBranch(this.branchName);
    const now = Math.floor(Date.now() / 1000);
    const author = { ...AUTHOR, timestamp: now, timezone: "+0000" };
    const commit = this.#repo.createCommit(tree, parent === null ? [] : [parent], trimmed, author);
    this.#repo.updateRef(`refs/heads/${this.branchName}`, commit);
    this.#baseOutline = clone(this.#outline);
    this.#baseContents = { ...this.#contents };
    this.flush();
  }

  exportPath(): string {
    return this.#repo.readBranch(this.branchName) === null ? "" : (this.#repo.gitDir ?? "");
  }
  close(): void {
    this.flush();
    this.#db.close();
  }
}
