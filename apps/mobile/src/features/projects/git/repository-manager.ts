import { Database } from "@novelevolver/mobile-sqlite";
import { WorktreeSession, type ProjectDbRecord } from "@novelevolver/worktree";
import type { Repository } from "nano-git/repository/core";

import {
  appFiles,
  copyPickedDocument,
  ensureDirectory,
  removePath,
} from "../../../shared/files/mobile-file-bridge";
import { getMobileAppState } from "./app-state";
import { openMobileRepository } from "./nano-git-sqlite";

export type OpenedProject = {
  record: ProjectDbRecord;
  repository: Repository;
  repositoryDb: Database;
  worktree: WorktreeSession;
  repositoryPath: string;
  close(): void;
};

const REPO_FILE = "repository.npk";
const SQLITE_ROOT = "novelevolver";

function sqliteLocation(id: number): string {
  return `${SQLITE_ROOT}/${id}`;
}

function sqliteRelativePath(id: number): string {
  return `${sqliteLocation(id)}/${REPO_FILE}`;
}

function sqliteAbsoluteDir(id: number): string {
  return `${appFiles.root}/${id}`;
}

function sqliteAbsoluteFile(id: number): string {
  return `${sqliteAbsoluteDir(id)}/${REPO_FILE}`;
}

function normalizeDisplayName(value: string): string {
  const name = value.trim();
  if (name === "") throw new Error("项目名称不能为空");
  return name;
}

function displayNameFromFile(fileName: string): string {
  return normalizeDisplayName(fileName.replace(/\.npk$/i, "") || "未命名项目");
}

function toOpenedRecord(record: ProjectDbRecord): ProjectDbRecord {
  return {
    ...record,
    displayName: record.displayName ?? displayNameFromFile(record.path),
  };
}

async function removeIfPresent(path: string): Promise<void> {
  try {
    await removePath(path);
  } catch {
    // Preserve the original operation error when best-effort cleanup fails.
  }
}

function openWorktree(repo: Repository, projectId: number, branchName: string): WorktreeSession {
  return new WorktreeSession(
    getMobileAppState().worktrees,
    repo.objects,
    repo,
    projectId,
    branchName,
  );
}

function openProjectRepository(id: number, readonly = false) {
  return openMobileRepository(REPO_FILE, sqliteLocation(id), readonly);
}

export class ProjectRepositoryManager {
  #opened: OpenedProject | null = null;
  #opening: { projectId: number; promise: Promise<OpenedProject> } | null = null;

  get records(): ProjectDbRecord[] {
    return getMobileAppState().projects.list().map(toOpenedRecord);
  }

  get opened(): OpenedProject | null {
    return this.#opened;
  }

  async createEmpty(displayName: string): Promise<OpenedProject> {
    const name = normalizeDisplayName(displayName);
    const { projects } = getMobileAppState();
    const pendingKey = `pending:${Date.now()}`;
    let record: ProjectDbRecord | null = null;
    let repositoryDb: Database | null = null;
    try {
      record = projects.upsertByPath(pendingKey, Date.now());
      projects.setDisplayName(record.id, name);
      await ensureDirectory(sqliteAbsoluteDir(record.id));
      const opened = openProjectRepository(record.id);
      repositoryDb = opened.db;
      const branchName = opened.repo.getCurrentBranch();
      if (branchName !== "main") {
        throw new Error("无法初始化 main 分支");
      }
      projects.setPath(record.id, sqliteRelativePath(record.id));
      const stored = projects.getById(record.id);
      if (stored === null) throw new Error("创建项目后无法读取记录");
      const worktree = openWorktree(opened.repo, stored.id, branchName);
      return this.#setOpened(
        toOpenedRecord({ ...stored, displayName: name }),
        opened.repo,
        repositoryDb,
        worktree,
      );
    } catch (error) {
      repositoryDb?.close();
      if (record !== null) {
        await removeIfPresent(sqliteAbsoluteDir(record.id));
        projects.removeById(record.id);
      }
      throw error;
    }
  }

  async importFromFile(
    sourceUri: string,
    fileName: string,
    confirmed = false,
  ): Promise<OpenedProject> {
    const { projects } = getMobileAppState();
    const displayName = displayNameFromFile(fileName);
    const pendingKey = `import:${Date.now()}`;
    let record: ProjectDbRecord | null = null;
    let repositoryDb: Database | null = null;
    try {
      const existing = projects.getByRemoteUrl(sourceUri);
      if (existing !== null && !confirmed) {
        throw new ProjectConflictError(toOpenedRecord(existing));
      }
      if (existing !== null) {
        await this.delete(existing.id, false);
      }

      record = projects.upsertByPath(pendingKey, Date.now());
      projects.setDisplayName(record.id, displayName);
      projects.setRemoteUrl(record.id, sourceUri);
      await ensureDirectory(sqliteAbsoluteDir(record.id));
      await copyPickedDocument({ uri: sourceUri, fileName }, sqliteAbsoluteFile(record.id));
      const opened = openProjectRepository(record.id);
      repositoryDb = opened.db;
      const branchName = opened.repo.getCurrentBranch();
      if (branchName === null || branchName === "") {
        throw new Error("项目没有可编辑的当前分支");
      }
      projects.setPath(record.id, sqliteRelativePath(record.id));
      const stored = projects.getById(record.id);
      if (stored === null) throw new Error("导入项目后无法读取记录");
      const worktree = openWorktree(opened.repo, stored.id, branchName);
      return this.#setOpened(
        toOpenedRecord({ ...stored, displayName }),
        opened.repo,
        repositoryDb,
        worktree,
      );
    } catch (error) {
      repositoryDb?.close();
      if (record !== null) {
        await removeIfPresent(sqliteAbsoluteDir(record.id));
        projects.removeById(record.id);
      }
      throw error;
    }
  }

  open(record: ProjectDbRecord): Promise<OpenedProject> {
    const opening = this.#opening;
    if (opening !== null) {
      if (opening.projectId === record.id) return opening.promise;
      return opening.promise.catch(() => undefined).then(() => this.open(record));
    }
    if (this.#opened?.record.id === record.id) return Promise.resolve(this.#opened);

    const promise = this.#openRecord(record);
    this.#opening = { projectId: record.id, promise };
    void promise.then(
      () => this.#clearOpening(promise),
      () => this.#clearOpening(promise),
    );
    return promise;
  }

  async #openRecord(record: ProjectDbRecord): Promise<OpenedProject> {
    await ensureDirectory(sqliteAbsoluteDir(record.id));
    let repositoryDb: Database | null = null;
    try {
      const opened = openProjectRepository(record.id);
      repositoryDb = opened.db;
      const branchName = opened.repo.getCurrentBranch();
      if (branchName === null || branchName === "") {
        throw new Error("项目没有可编辑的当前分支");
      }
      const worktree = openWorktree(opened.repo, record.id, branchName);
      const stored = getMobileAppState().projects.touchById(record.id, Date.now());
      if (stored === null) throw new Error("项目不存在");
      return this.#setOpened(toOpenedRecord(stored), opened.repo, repositoryDb, worktree);
    } catch (error) {
      repositoryDb?.close();
      throw error;
    }
  }

  #clearOpening(promise: Promise<OpenedProject>): void {
    if (this.#opening?.promise === promise) this.#opening = null;
  }

  async delete(id: number, updateCatalog = true): Promise<void> {
    if (this.#opened?.record.id === id) this.close();
    const { projects } = getMobileAppState();
    await removeIfPresent(sqliteAbsoluteDir(id));
    if (updateCatalog) projects.removeById(id);
  }

  rename(id: number, displayName: string): ProjectDbRecord {
    const { projects } = getMobileAppState();
    const name = normalizeDisplayName(displayName);
    projects.setDisplayName(id, name);
    const record = projects.getById(id);
    if (record === null) throw new Error("项目不存在");
    const updated = toOpenedRecord(record);
    if (this.#opened?.record.id === id) this.#opened = { ...this.#opened, record: updated };
    return updated;
  }

  close(): void {
    this.#opened?.close();
    this.#opened = null;
  }

  #setOpened(
    record: ProjectDbRecord,
    repository: Repository,
    repositoryDb: Database,
    worktree: WorktreeSession,
  ): OpenedProject {
    this.close();
    const opened: OpenedProject = {
      record,
      repository,
      repositoryDb,
      worktree,
      repositoryPath: sqliteAbsoluteFile(record.id),
      close: () => {
        worktree[Symbol.dispose]();
        repositoryDb.close();
      },
    };
    this.#opened = opened;
    return opened;
  }
}

export class ProjectConflictError extends Error {
  readonly name = "ProjectConflictError";

  constructor(readonly existing: ProjectDbRecord) {
    super(`项目已存在：${existing.displayName ?? existing.path}`);
  }
}

export const projectStorage = new ProjectRepositoryManager();
