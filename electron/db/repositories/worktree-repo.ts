import type { DatabaseSync, SQLInputValue } from "node:sqlite";

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

export type WorktreeLocalSnapshotDomain = "manuscript" | "resource";

export type WorktreeLocalSnapshotRecord = {
  projectId: number;
  branchName: string;
  snapshotId: string;
  domain: WorktreeLocalSnapshotDomain;
  entityId: string;
  capturedAt: number;
  revision: number;
  label: string;
  displayPath: string;
  contentSha: string;
  content: Buffer;
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

type WorktreeLocalSnapshotSqlRow = {
  project_id: number;
  branch_name: string;
  snapshot_id: string;
  domain: WorktreeLocalSnapshotDomain;
  entity_id: string;
  captured_at: number;
  revision: number;
  label: string;
  display_path: string;
  content_sha: string;
  content: Uint8Array;
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

function rowToLocalSnapshotRecord(row: WorktreeLocalSnapshotSqlRow): WorktreeLocalSnapshotRecord {
  return {
    projectId: row.project_id,
    branchName: row.branch_name,
    snapshotId: row.snapshot_id,
    domain: row.domain,
    entityId: row.entity_id,
    capturedAt: row.captured_at,
    revision: row.revision,
    label: row.label,
    displayPath: row.display_path,
    contentSha: row.content_sha,
    content: Buffer.from(row.content),
  };
}

/**
 * worktree 及 manuscript / resource 节点表的 query 接口。
 *
 * 不负责建表（schema 由 initWorktreeSchema 在 AppDatabase 启动时执行），
 * 也不 open 自己的连接，构造时注入共享 DatabaseSync 句柄。
 * worktree.project_id -> projects(id) 的 ON DELETE CASCADE 由 schema 保证，
 * 因此不再需要 deleteWorktreesForProject 这类手动级联清理。
 */
export class WorktreeRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
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

  readLocalSnapshots(
    projectId: number,
    branchName: string,
    domain: WorktreeLocalSnapshotDomain,
    entityId: string,
    limit: number,
  ): WorktreeLocalSnapshotRecord[] {
    const rows = this.#db
      .prepare(
        `
          SELECT
            project_id,
            branch_name,
            snapshot_id,
            domain,
            entity_id,
            captured_at,
            revision,
            label,
            display_path,
            content_sha,
            content
          FROM worktree_local_snapshot
          WHERE
            project_id = ?
            AND branch_name = ?
            AND domain = ?
            AND entity_id = ?
          ORDER BY captured_at DESC, revision DESC, snapshot_id DESC
          LIMIT ?
        `,
      )
      .all(projectId, branchName, domain, entityId, limit) as WorktreeLocalSnapshotSqlRow[];
    return rows.map(rowToLocalSnapshotRecord);
  }

  getLocalSnapshot(
    projectId: number,
    branchName: string,
    snapshotId: string,
  ): WorktreeLocalSnapshotRecord | null {
    const row = this.#db
      .prepare(
        `
          SELECT
            project_id,
            branch_name,
            snapshot_id,
            domain,
            entity_id,
            captured_at,
            revision,
            label,
            display_path,
            content_sha,
            content
          FROM worktree_local_snapshot
          WHERE project_id = ? AND branch_name = ? AND snapshot_id = ?
        `,
      )
      .get(projectId, branchName, snapshotId) as WorktreeLocalSnapshotSqlRow | undefined;
    return row === undefined ? null : rowToLocalSnapshotRecord(row);
  }

  recordLocalSnapshot(
    record: WorktreeLocalSnapshotRecord,
    coalesceWindowMs: number,
  ): WorktreeLocalSnapshotRecord | null {
    const latest = this.#db
      .prepare(
        `
          SELECT
            project_id,
            branch_name,
            snapshot_id,
            domain,
            entity_id,
            captured_at,
            revision,
            label,
            display_path,
            content_sha,
            content
          FROM worktree_local_snapshot
          WHERE
            project_id = ?
            AND branch_name = ?
            AND domain = ?
            AND entity_id = ?
          ORDER BY captured_at DESC, revision DESC, snapshot_id DESC
          LIMIT 1
        `,
      )
      .get(record.projectId, record.branchName, record.domain, record.entityId) as
      | WorktreeLocalSnapshotSqlRow
      | undefined;

    if (latest !== undefined && latest.content_sha === record.contentSha) {
      return null;
    }

    if (latest !== undefined && record.capturedAt - latest.captured_at <= coalesceWindowMs) {
      this.#db
        .prepare(
          `
            UPDATE worktree_local_snapshot
            SET
              captured_at = ?,
              revision = ?,
              label = ?,
              display_path = ?,
              content_sha = ?,
              content = ?
            WHERE project_id = ? AND branch_name = ? AND snapshot_id = ?
          `,
        )
        .run(
          record.capturedAt,
          record.revision,
          record.label,
          record.displayPath,
          record.contentSha,
          record.content,
          record.projectId,
          record.branchName,
          latest.snapshot_id,
        );
      return {
        ...record,
        snapshotId: latest.snapshot_id,
      };
    }

    this.#db
      .prepare(
        `
          INSERT INTO worktree_local_snapshot (
            project_id,
            branch_name,
            snapshot_id,
            domain,
            entity_id,
            captured_at,
            revision,
            label,
            display_path,
            content_sha,
            content
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        record.projectId,
        record.branchName,
        record.snapshotId,
        record.domain,
        record.entityId,
        record.capturedAt,
        record.revision,
        record.label,
        record.displayPath,
        record.contentSha,
        record.content,
      );
    return record;
  }

  /**
   * 在共享连接上执行 IMMEDIATE 事务。跨 repo 写入可放进同一事务，
   * 与 AppDatabase.transaction() 等价（同一底层连接）。
   */
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
