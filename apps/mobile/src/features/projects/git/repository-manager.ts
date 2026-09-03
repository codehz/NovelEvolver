import { ProjectAiChatController } from "@novelevolver/ai-runtime";
import {
  Database,
  PROJECTS_LOCATION,
  deleteProjectFile,
  displayNameFromFile,
  importProjectFile,
  listProjectFiles,
  notifyProjectFilesChanged,
  projectFileExists,
  renameProjectFile,
  shareProjectFile,
  toProjectFileName,
} from "@novelevolver/mobile-sqlite";
import { WorktreeSession, type ProjectDbRecord } from "@novelevolver/worktree";
import type { Repository } from "nano-git/repository/core";

import { getMobileSettings } from "../../../shared/settings/session";
import { getMobileAppState } from "./app-state";
import { openMobileRepository } from "./nano-git-sqlite";

export type OpenedProject = {
  record: ProjectDbRecord;
  repository: Repository;
  repositoryDb: Database;
  worktree: WorktreeSession;
  fileName: string;
  aiChat: ProjectAiChatController;
  close(): void;
};

function normalizeDisplayName(value: string): string {
  const name = value.trim();
  if (name === "") throw new Error("项目名称不能为空");
  return name;
}

function toOpenedRecord(record: ProjectDbRecord): ProjectDbRecord {
  return {
    ...record,
    displayName: record.displayName ?? displayNameFromFile(record.path),
  };
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

function openProjectRepository(fileName: string, readonly = false) {
  const opened = openMobileRepository(fileName, PROJECTS_LOCATION, readonly);
  opened.db.exec("PRAGMA journal_mode = DELETE");
  opened.db.exec("PRAGMA busy_timeout = 5000");
  return opened;
}

function removeFileIfPresent(fileName: string): void {
  try {
    if (projectFileExists(fileName)) deleteProjectFile(fileName);
  } catch {
    // Preserve the original operation error when best-effort cleanup fails.
  }
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

  syncFromDisk(): void {
    const files = new Set(listProjectFiles());
    const { projects } = getMobileAppState();
    for (const record of projects.list()) {
      if (files.has(record.path)) continue;
      if (this.#opened?.record.id === record.id) this.close();
      projects.removeById(record.id);
    }
    for (const fileName of files) {
      if (projects.getByPath(fileName) !== null) continue;
      const record = projects.upsertByPath(fileName, Date.now());
      projects.setDisplayName(record.id, displayNameFromFile(fileName));
    }
  }

  importProject(): Promise<string | null> {
    return importProjectFile();
  }

  async createEmpty(displayName: string): Promise<OpenedProject> {
    const name = normalizeDisplayName(displayName);
    const fileName = toProjectFileName(name);
    const { projects } = getMobileAppState();
    this.syncFromDisk();
    if (projectFileExists(fileName) || projects.getByPath(fileName) !== null) {
      throw new Error("已存在同名项目文件");
    }
    let record: ProjectDbRecord | null = null;
    let repositoryDb: Database | null = null;
    try {
      record = projects.upsertByPath(fileName, Date.now());
      projects.setDisplayName(record.id, name);
      const opened = openProjectRepository(fileName);
      repositoryDb = opened.db;
      const branchName = opened.repo.getCurrentBranch();
      if (branchName !== "main") {
        throw new Error("无法初始化 main 分支");
      }
      notifyProjectFilesChanged();
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
        removeFileIfPresent(fileName);
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
    if (!projectFileExists(record.path)) {
      throw new Error("项目文件不存在");
    }
    let repositoryDb: Database | null = null;
    try {
      const opened = openProjectRepository(record.path);
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

  async delete(id: number): Promise<void> {
    const { projects } = getMobileAppState();
    const record = projects.getById(id);
    if (this.#opened?.record.id === id) this.close();
    if (record !== null) removeFileIfPresent(record.path);
    projects.removeById(id);
    notifyProjectFilesChanged();
  }

  rename(id: number, displayName: string): ProjectDbRecord {
    const { projects } = getMobileAppState();
    const name = normalizeDisplayName(displayName);
    const record = projects.getById(id);
    if (record === null) throw new Error("项目不存在");
    const nextFileName = toProjectFileName(name);
    if (nextFileName !== record.path) {
      if (projectFileExists(nextFileName) || projects.getByPath(nextFileName) !== null) {
        throw new Error("已存在同名项目文件");
      }
      renameProjectFile(record.path, nextFileName);
      projects.setPath(id, nextFileName);
      notifyProjectFilesChanged();
    }
    projects.setDisplayName(id, name);
    const updated = projects.getById(id);
    if (updated === null) throw new Error("项目不存在");
    const openedRecord = toOpenedRecord(updated);
    if (this.#opened?.record.id === id) {
      this.#opened = { ...this.#opened, record: openedRecord, fileName: nextFileName };
    }
    return openedRecord;
  }

  share(id: number): void {
    const record =
      this.#opened?.record.id === id
        ? this.#opened.record
        : getMobileAppState().projects.getById(id);
    if (record === null) throw new Error("项目不存在");
    shareProjectFile(record.path);
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
      fileName: record.path,
      aiChat: null as unknown as ProjectAiChatController,
      close: () => {
        opened.aiChat[Symbol.dispose]();
        worktree[Symbol.dispose]();
        repositoryDb.close();
      },
    };
    opened.aiChat = new ProjectAiChatController({
      projectId: record.id,
      repository: getMobileAppState().aiChat,
      resolveWorktree: () => opened.worktree,
      mockAiEnabled: __DEV__,
      getAiModelsStore: () => getMobileSettings().models,
      getAiAgentsStore: () => getMobileSettings().agents,
      getAiRuntimePolicyStore: () => getMobileSettings().policy,
    });
    this.#opened = opened;
    return opened;
  }
}

export const projectStorage = new ProjectRepositoryManager();
