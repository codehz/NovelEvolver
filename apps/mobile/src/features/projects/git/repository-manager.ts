import { Database } from "@novelevolver/mobile-sqlite";
import type { Repository } from "nano-git/repository/core";

import {
  appFiles,
  copyPath,
  copyPickedDocument,
  ensureDirectory,
  removePath,
} from "../../../shared/files/mobile-file-bridge";
import {
  createProjectRecord,
  findProjectBySourceUri,
  readProjectCatalog,
  removeProjectRecord,
  type MobileProjectRecord,
  upsertProjectRecord,
} from "../catalog/project-catalog";
import { WorktreeSession } from "../worktree/worktree-session";
import { openMobileRepository } from "./nano-git-sqlite";

export type OpenedProject = {
  record: MobileProjectRecord;
  repository: Repository;
  repositoryDb: Database;
  worktreeDb: Database;
  worktree: WorktreeSession;
  repositoryPath: string;
  close(): void;
};

function projectDirectory(id: string): string {
  return `${appFiles.root}/${id}`;
}

function repositoryPath(record: MobileProjectRecord): string {
  return `${projectDirectory(record.id)}/${record.repositoryFileName}`;
}

function normalizeDisplayName(value: string): string {
  const name = value.trim();
  if (name === "") throw new Error("项目名称不能为空");
  return name;
}

function displayNameFromFile(fileName: string): string {
  return normalizeDisplayName(fileName.replace(/\.npk$/i, "") || "未命名项目");
}

async function closeDatabases(
  repositoryDb: Database | null,
  worktreeDb: Database | null,
): Promise<void> {
  worktreeDb?.close();
  repositoryDb?.close();
}

async function removeIfPresent(path: string): Promise<void> {
  try {
    await removePath(path);
  } catch {
    // Preserve the original operation error when best-effort cleanup fails.
  }
}

export class ProjectRepositoryManager {
  #opened: OpenedProject | null = null;

  get records(): MobileProjectRecord[] {
    return readProjectCatalog();
  }

  get opened(): OpenedProject | null {
    return this.#opened;
  }

  async createEmpty(displayName: string): Promise<OpenedProject> {
    const record = createProjectRecord(normalizeDisplayName(displayName), null);
    let repositoryDb: Database | null = null;
    let worktreeDb: Database | null = null;
    try {
      await ensureDirectory(projectDirectory(record.id));
      const opened = openMobileRepository(record.repositoryFileName, projectDirectory(record.id));
      repositoryDb = opened.db;
      if (opened.repo.getCurrentBranch() !== "main") {
        opened.close();
        repositoryDb = null;
        throw new Error("无法初始化 main 分支");
      }
      worktreeDb = Database.open(record.worktreeFileName, {
        location: projectDirectory(record.id),
      });
      const worktree = WorktreeSession.open(worktreeDb, opened.repo);
      upsertProjectRecord(record);
      return this.#setOpened(record, opened.repo, repositoryDb, worktreeDb, worktree);
    } catch (error) {
      await closeDatabases(repositoryDb, worktreeDb);
      await removeIfPresent(projectDirectory(record.id));
      throw error;
    }
  }

  async importFromFile(
    sourceUri: string,
    fileName: string,
    confirmed = false,
  ): Promise<OpenedProject> {
    const candidate = createProjectRecord(displayNameFromFile(fileName), sourceUri);
    const directory = projectDirectory(candidate.id);
    const staging = `${appFiles.cache}/${candidate.id}.npk`;
    let repositoryDb: Database | null = null;
    let worktreeDb: Database | null = null;
    try {
      await ensureDirectory(directory);
      await copyPickedDocument({ uri: sourceUri, fileName }, staging);
      const validation = openMobileRepository(`${candidate.id}.npk`, appFiles.cache);
      try {
        const branch = validation.repo.getCurrentBranch();
        if (branch === null || branch === "") {
          throw new Error("项目没有可编辑的当前分支");
        }
      } finally {
        validation.close();
      }

      const existing = findProjectBySourceUri(sourceUri);
      if (existing !== null && !confirmed) {
        throw new ProjectConflictError(existing);
      }
      if (existing !== null) {
        await this.delete(existing.id, false);
      }
      await copyPath(staging, repositoryPath(candidate));
      await removeIfPresent(staging);
      const opened = openMobileRepository(candidate.repositoryFileName, directory);
      repositoryDb = opened.db;
      worktreeDb = Database.open(candidate.worktreeFileName, { location: directory });
      const worktree = WorktreeSession.open(worktreeDb, opened.repo);
      upsertProjectRecord(candidate);
      return this.#setOpened(candidate, opened.repo, repositoryDb, worktreeDb, worktree);
    } catch (error) {
      await closeDatabases(repositoryDb, worktreeDb);
      await removeIfPresent(staging);
      await removeIfPresent(directory);
      throw error;
    }
  }

  async open(record: MobileProjectRecord): Promise<OpenedProject> {
    const directory = projectDirectory(record.id);
    await ensureDirectory(directory);
    let repositoryDb: Database | null = null;
    let worktreeDb: Database | null = null;
    try {
      const opened = openMobileRepository(record.repositoryFileName, directory);
      repositoryDb = opened.db;
      worktreeDb = Database.open(record.worktreeFileName, { location: directory });
      const worktree = WorktreeSession.open(worktreeDb, opened.repo);
      const updated = { ...record, lastOpenedAt: Date.now() };
      upsertProjectRecord(updated);
      return this.#setOpened(updated, opened.repo, repositoryDb, worktreeDb, worktree);
    } catch (error) {
      await closeDatabases(repositoryDb, worktreeDb);
      throw error;
    }
  }

  async delete(id: string, updateCatalog = true): Promise<void> {
    if (this.#opened?.record.id === id) this.close();
    const record = readProjectCatalog().find((item) => item.id === id);
    if (record !== undefined) await removePath(projectDirectory(record.id));
    if (updateCatalog) removeProjectRecord(id);
  }

  rename(id: string, displayName: string): MobileProjectRecord {
    const record = readProjectCatalog().find((item) => item.id === id);
    if (record === undefined) throw new Error("项目不存在");
    const updated = { ...record, displayName: normalizeDisplayName(displayName) };
    upsertProjectRecord(updated);
    if (this.#opened?.record.id === id) this.#opened = { ...this.#opened, record: updated };
    return updated;
  }

  close(): void {
    this.#opened?.close();
    this.#opened = null;
  }

  #setOpened(
    record: MobileProjectRecord,
    repository: Repository,
    repositoryDb: Database,
    worktreeDb: Database,
    worktree: WorktreeSession,
  ): OpenedProject {
    this.close();
    const opened: OpenedProject = {
      record,
      repository,
      repositoryDb,
      worktreeDb,
      worktree,
      repositoryPath: repositoryPath(record),
      close: () => {
        worktree.close();
        repositoryDb.close();
      },
    };
    this.#opened = opened;
    return opened;
  }
}

export class ProjectConflictError extends Error {
  readonly name = "ProjectConflictError";

  constructor(readonly existing: MobileProjectRecord) {
    super(`项目已存在：${existing.displayName}`);
  }
}

export const projectStorage = new ProjectRepositoryManager();
