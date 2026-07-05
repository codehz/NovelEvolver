import { DatabaseSync, type SQLInputValue } from "node:sqlite";

export type WorktreeRecord = {
  projectId: number;
  branchName: string;
  baseCommitSha: string | null;
  revision: number;
  warning: string | null;
};

export type ManuscriptNodeCurrentRow = {
  projectId: number;
  branchName: string;
  id: string;
  parentId: string | null;
  type: "folder" | "chapter";
  title: string;
  sortIndex: number;
  content: Buffer | null;
};

export type ManuscriptNodeCommittedRow = {
  projectId: number;
  branchName: string;
  id: string;
  parentId: string | null;
  type: "folder" | "chapter";
  title: string;
  sortIndex: number;
  contentSha: string | null;
};

export type ResourceNodeCurrentRow = {
  projectId: number;
  branchName: string;
  id: string;
  parentId: string | null;
  type: "folder" | "file";
  name: string;
  content: Buffer | null;
};

export type ResourceNodeCommittedRow = {
  projectId: number;
  branchName: string;
  id: string;
  parentId: string | null;
  type: "folder" | "file";
  name: string;
  contentSha: string | null;
};

type WorktreeRow = {
  project_id: number;
  branch_name: string;
  base_commit_sha: string | null;
  revision: number;
  warning: string | null;
};

type ManuscriptCurrentSqlRow = {
  project_id: number;
  branch_name: string;
  id: string;
  parent_id: string | null;
  type: "folder" | "chapter";
  title: string;
  sort_index: number;
  content: Uint8Array | null;
};

type ManuscriptCommittedSqlRow = {
  project_id: number;
  branch_name: string;
  id: string;
  parent_id: string | null;
  type: "folder" | "chapter";
  title: string;
  sort_index: number;
  content_sha: string | null;
};

type ResourceCurrentSqlRow = {
  project_id: number;
  branch_name: string;
  id: string;
  parent_id: string | null;
  type: "folder" | "file";
  name: string;
  content: Uint8Array | null;
};

type ResourceCommittedSqlRow = {
  project_id: number;
  branch_name: string;
  id: string;
  parent_id: string | null;
  type: "folder" | "file";
  name: string;
  content_sha: string | null;
};

function toBuffer(value: Uint8Array | null): Buffer | null {
  return value === null ? null : Buffer.from(value);
}

function rowToWorktreeRecord(row: WorktreeRow): WorktreeRecord {
  return {
    projectId: row.project_id,
    branchName: row.branch_name,
    baseCommitSha: row.base_commit_sha,
    revision: row.revision,
    warning: row.warning,
  };
}

export class WorktreesStore {
  readonly #db: DatabaseSync;

  constructor(dbPath: string) {
    this.#db = new DatabaseSync(dbPath);
    this.#db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS worktree (
        project_id INTEGER NOT NULL,
        branch_name TEXT NOT NULL,
        base_commit_sha TEXT,
        revision INTEGER NOT NULL DEFAULT 0,
        warning TEXT,
        PRIMARY KEY (project_id, branch_name)
      );

      CREATE TABLE IF NOT EXISTS manuscript_node_current (
        project_id INTEGER NOT NULL,
        branch_name TEXT NOT NULL,
        id TEXT NOT NULL,
        parent_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        sort_index INTEGER NOT NULL,
        content BLOB,
        PRIMARY KEY (project_id, branch_name, id),
        FOREIGN KEY (project_id, branch_name)
          REFERENCES worktree(project_id, branch_name) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS manuscript_node_committed (
        project_id INTEGER NOT NULL,
        branch_name TEXT NOT NULL,
        id TEXT NOT NULL,
        parent_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        sort_index INTEGER NOT NULL,
        content_sha TEXT,
        PRIMARY KEY (project_id, branch_name, id),
        FOREIGN KEY (project_id, branch_name)
          REFERENCES worktree(project_id, branch_name) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS resource_node_current (
        project_id INTEGER NOT NULL,
        branch_name TEXT NOT NULL,
        id TEXT NOT NULL,
        parent_id TEXT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        content BLOB,
        PRIMARY KEY (project_id, branch_name, id),
        FOREIGN KEY (project_id, branch_name)
          REFERENCES worktree(project_id, branch_name) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS resource_node_committed (
        project_id INTEGER NOT NULL,
        branch_name TEXT NOT NULL,
        id TEXT NOT NULL,
        parent_id TEXT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        content_sha TEXT,
        PRIMARY KEY (project_id, branch_name, id),
        FOREIGN KEY (project_id, branch_name)
          REFERENCES worktree(project_id, branch_name) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_manuscript_current_parent
        ON manuscript_node_current(project_id, branch_name, parent_id);
      CREATE INDEX IF NOT EXISTS idx_manuscript_committed_parent
        ON manuscript_node_committed(project_id, branch_name, parent_id);
      CREATE INDEX IF NOT EXISTS idx_resource_current_parent
        ON resource_node_current(project_id, branch_name, parent_id);
      CREATE INDEX IF NOT EXISTS idx_resource_committed_parent
        ON resource_node_committed(project_id, branch_name, parent_id);
    `);
  }

  hasWorktree(projectId: number, branchName: string): boolean {
    const row = this.#db
      .prepare(
        `
          SELECT 1
          FROM worktree
          WHERE project_id = ? AND branch_name = ?
        `,
      )
      .get(projectId, branchName) as { 1: 1 } | undefined;
    return row !== undefined;
  }

  getWorktree(projectId: number, branchName: string): WorktreeRecord | null {
    const row = this.#db
      .prepare(
        `
          SELECT project_id, branch_name, base_commit_sha, revision, warning
          FROM worktree
          WHERE project_id = ? AND branch_name = ?
        `,
      )
      .get(projectId, branchName) as WorktreeRow | undefined;
    return row === undefined ? null : rowToWorktreeRecord(row);
  }

  upsertWorktree(record: WorktreeRecord): void {
    this.#db
      .prepare(
        `
          INSERT INTO worktree (project_id, branch_name, base_commit_sha, revision, warning)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(project_id, branch_name)
          DO UPDATE SET
            base_commit_sha = excluded.base_commit_sha,
            revision = excluded.revision,
            warning = excluded.warning
        `,
      )
      .run(
        record.projectId,
        record.branchName,
        record.baseCommitSha,
        record.revision,
        record.warning,
      );
  }

  readManuscriptCurrentRows(projectId: number, branchName: string): ManuscriptNodeCurrentRow[] {
    const rows = this.#db
      .prepare(
        `
          SELECT project_id, branch_name, id, parent_id, type, title, sort_index, content
          FROM manuscript_node_current
          WHERE project_id = ? AND branch_name = ?
          ORDER BY parent_id IS NOT NULL, parent_id, sort_index, id
        `,
      )
      .all(projectId, branchName) as ManuscriptCurrentSqlRow[];

    return rows.map((row) => ({
      projectId: row.project_id,
      branchName: row.branch_name,
      id: row.id,
      parentId: row.parent_id,
      type: row.type,
      title: row.title,
      sortIndex: row.sort_index,
      content: toBuffer(row.content),
    }));
  }

  readManuscriptCommittedRows(projectId: number, branchName: string): ManuscriptNodeCommittedRow[] {
    const rows = this.#db
      .prepare(
        `
          SELECT project_id, branch_name, id, parent_id, type, title, sort_index, content_sha
          FROM manuscript_node_committed
          WHERE project_id = ? AND branch_name = ?
          ORDER BY parent_id IS NOT NULL, parent_id, sort_index, id
        `,
      )
      .all(projectId, branchName) as ManuscriptCommittedSqlRow[];

    return rows.map((row) => ({
      projectId: row.project_id,
      branchName: row.branch_name,
      id: row.id,
      parentId: row.parent_id,
      type: row.type,
      title: row.title,
      sortIndex: row.sort_index,
      contentSha: row.content_sha,
    }));
  }

  readResourceCurrentRows(projectId: number, branchName: string): ResourceNodeCurrentRow[] {
    const rows = this.#db
      .prepare(
        `
          SELECT project_id, branch_name, id, parent_id, type, name, content
          FROM resource_node_current
          WHERE project_id = ? AND branch_name = ?
          ORDER BY parent_id IS NOT NULL, parent_id, type, name, id
        `,
      )
      .all(projectId, branchName) as ResourceCurrentSqlRow[];

    return rows.map((row) => ({
      projectId: row.project_id,
      branchName: row.branch_name,
      id: row.id,
      parentId: row.parent_id,
      type: row.type,
      name: row.name,
      content: toBuffer(row.content),
    }));
  }

  readResourceCommittedRows(projectId: number, branchName: string): ResourceNodeCommittedRow[] {
    const rows = this.#db
      .prepare(
        `
          SELECT project_id, branch_name, id, parent_id, type, name, content_sha
          FROM resource_node_committed
          WHERE project_id = ? AND branch_name = ?
          ORDER BY parent_id IS NOT NULL, parent_id, type, name, id
        `,
      )
      .all(projectId, branchName) as ResourceCommittedSqlRow[];

    return rows.map((row) => ({
      projectId: row.project_id,
      branchName: row.branch_name,
      id: row.id,
      parentId: row.parent_id,
      type: row.type,
      name: row.name,
      contentSha: row.content_sha,
    }));
  }

  replaceManuscriptCurrentRows(
    projectId: number,
    branchName: string,
    rows: readonly ManuscriptNodeCurrentRow[],
  ): void {
    this.#replaceRows(
      `DELETE FROM manuscript_node_current WHERE project_id = ? AND branch_name = ?`,
      `
        INSERT INTO manuscript_node_current (
          project_id, branch_name, id, parent_id, type, title, sort_index, content
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      projectId,
      branchName,
      rows.map((row) => [
        row.projectId,
        row.branchName,
        row.id,
        row.parentId,
        row.type,
        row.title,
        row.sortIndex,
        row.content,
      ]),
    );
  }

  replaceManuscriptCommittedRows(
    projectId: number,
    branchName: string,
    rows: readonly ManuscriptNodeCommittedRow[],
  ): void {
    this.#replaceRows(
      `DELETE FROM manuscript_node_committed WHERE project_id = ? AND branch_name = ?`,
      `
        INSERT INTO manuscript_node_committed (
          project_id, branch_name, id, parent_id, type, title, sort_index, content_sha
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      projectId,
      branchName,
      rows.map((row) => [
        row.projectId,
        row.branchName,
        row.id,
        row.parentId,
        row.type,
        row.title,
        row.sortIndex,
        row.contentSha,
      ]),
    );
  }

  replaceResourceCurrentRows(
    projectId: number,
    branchName: string,
    rows: readonly ResourceNodeCurrentRow[],
  ): void {
    this.#replaceRows(
      `DELETE FROM resource_node_current WHERE project_id = ? AND branch_name = ?`,
      `
        INSERT INTO resource_node_current (
          project_id, branch_name, id, parent_id, type, name, content
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      projectId,
      branchName,
      rows.map((row) => [
        row.projectId,
        row.branchName,
        row.id,
        row.parentId,
        row.type,
        row.name,
        row.content,
      ]),
    );
  }

  replaceResourceCommittedRows(
    projectId: number,
    branchName: string,
    rows: readonly ResourceNodeCommittedRow[],
  ): void {
    this.#replaceRows(
      `DELETE FROM resource_node_committed WHERE project_id = ? AND branch_name = ?`,
      `
        INSERT INTO resource_node_committed (
          project_id, branch_name, id, parent_id, type, name, content_sha
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      projectId,
      branchName,
      rows.map((row) => [
        row.projectId,
        row.branchName,
        row.id,
        row.parentId,
        row.type,
        row.name,
        row.contentSha,
      ]),
    );
  }

  transaction<T>(operation: () => T): T {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.#db.exec("COMMIT");
      return result;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  deleteWorktreesForProject(projectId: number): number {
    const result = this.#db.prepare(`DELETE FROM worktree WHERE project_id = ?`).run(projectId);
    return Number(result.changes);
  }

  close(): void {
    this.#db.close();
  }

  #replaceRows(
    deleteSql: string,
    insertSql: string,
    projectId: number,
    branchName: string,
    valueRows: ReadonlyArray<readonly SQLInputValue[]>,
  ): void {
    this.#db.prepare(deleteSql).run(projectId, branchName);
    const insertStmt = this.#db.prepare(insertSql);
    for (const row of valueRows) {
      insertStmt.run(...row);
    }
  }
}
