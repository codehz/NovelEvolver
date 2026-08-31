import type { DatabasePort, SqlValue } from "./database-port";

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
  contentRevision: number;
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
  contentRevision: number;
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

export type WorktreeJournalDomain = "manuscript" | "resource";
export type WorktreeJournalSource =
  | "autosave"
  | "manual-checkpoint"
  | "structure-edit"
  | "restore"
  | "commit"
  | "import"
  | "search-replace";
export type WorktreeJournalActor = "user" | "system";
export type WorktreeJournalOperationKind =
  | "create"
  | "delete"
  | "rename"
  | "move"
  | "reorder"
  | "content"
  | "restore";
export type WorktreeJournalEntityKind = "chapter" | "folder" | "file";

export type WorktreeBlobRecord = {
  projectId: number;
  blobId: string;
  contentSha: string;
  content: Buffer;
};

export type WorktreeJournalEntryRecord = {
  projectId: number;
  branchName: string;
  entryId: string;
  createdAt: number;
  updatedAt: number;
  worktreeRevision: number;
  actor: WorktreeJournalActor;
  source: WorktreeJournalSource;
  title: string;
  kind: WorktreeJournalOperationKind;
  domain: WorktreeJournalDomain;
  entityId: string;
  entityKind: WorktreeJournalEntityKind;
  label: string;
  displayPath: string;
  previousLabel: string | null;
  previousPath: string | null;
  beforeBlobId: string | null;
  afterBlobId: string | null;
  statsAdded: number | null;
  statsRemoved: number | null;
  commitHash: string | null;
  groupKey: string | null;
  metadataJson: string | null;
  beforeContent: Buffer | null;
  afterContent: Buffer | null;
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
  content_revision: number;
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
  content_revision: number;
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

type WorktreeJournalEntrySqlRow = {
  project_id: number;
  branch_name: string;
  entry_id: string;
  created_at: number;
  updated_at: number;
  worktree_revision: number;
  actor: WorktreeJournalActor;
  source: WorktreeJournalSource;
  title: string;
  kind: WorktreeJournalOperationKind;
  domain: WorktreeJournalDomain;
  entity_id: string;
  entity_kind: WorktreeJournalEntityKind;
  label: string;
  display_path: string;
  previous_label: string | null;
  previous_path: string | null;
  before_blob_id: string | null;
  after_blob_id: string | null;
  stats_added: number | null;
  stats_removed: number | null;
  commit_hash: string | null;
  group_key: string | null;
  metadata_json: string | null;
  before_content: Uint8Array | null;
  after_content: Uint8Array | null;
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

function rowToJournalEntryRecord(row: WorktreeJournalEntrySqlRow): WorktreeJournalEntryRecord {
  return {
    projectId: row.project_id,
    branchName: row.branch_name,
    entryId: row.entry_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    worktreeRevision: row.worktree_revision,
    actor: row.actor,
    source: row.source,
    title: row.title,
    kind: row.kind,
    domain: row.domain,
    entityId: row.entity_id,
    entityKind: row.entity_kind,
    label: row.label,
    displayPath: row.display_path,
    previousLabel: row.previous_label,
    previousPath: row.previous_path,
    beforeBlobId: row.before_blob_id,
    afterBlobId: row.after_blob_id,
    statsAdded: row.stats_added,
    statsRemoved: row.stats_removed,
    commitHash: row.commit_hash,
    groupKey: row.group_key,
    metadataJson: row.metadata_json,
    beforeContent: toBuffer(row.before_content),
    afterContent: toBuffer(row.after_content),
  };
}

/**
 * worktree 及 manuscript / resource 节点表的 query 接口。
 *
 * 不负责建表（schema 由 initAppState 执行），也不 open 自己的连接。
 * 构造时注入 DatabasePort。worktree.project_id -> projects(id) 的
 * ON DELETE CASCADE 由 schema 保证。
 */
export class WorktreeRepository {
  readonly #db: DatabasePort;

  constructor(db: DatabasePort) {
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
    return row != null;
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
    return row == null ? null : rowToWorktreeRecord(row);
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

  /**
   * Deletes one branch worktree row. Child manuscript/resource/journal rows are
   * removed via ON DELETE CASCADE on `(project_id, branch_name)`.
   */
  deleteWorktree(projectId: number, branchName: string): boolean {
    const result = this.#db
      .prepare(
        `
          DELETE FROM worktree
          WHERE project_id = ? AND branch_name = ?
        `,
      )
      .run(projectId, branchName);
    return result.changes > 0;
  }

  readManuscriptCurrentRows(projectId: number, branchName: string): ManuscriptNodeCurrentRow[] {
    const rows = this.#db
      .prepare(
        `
          SELECT project_id, branch_name, id, parent_id, type, title, sort_index, content, content_revision
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
      contentRevision: row.content_revision,
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
          SELECT project_id, branch_name, id, parent_id, type, name, content, content_revision
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
      contentRevision: row.content_revision,
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
          project_id, branch_name, id, parent_id, type, title, sort_index, content, content_revision
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        row.contentRevision,
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
          project_id, branch_name, id, parent_id, type, name, content, content_revision
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
        row.name,
        row.content,
        row.contentRevision,
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

  upsertJournalBlob(record: WorktreeBlobRecord): void {
    this.#db
      .prepare(
        `
          INSERT INTO worktree_blob (project_id, blob_id, content_sha, content)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(project_id, blob_id)
          DO NOTHING
        `,
      )
      .run(record.projectId, record.blobId, record.contentSha, record.content);
  }

  readJournalHistoryEntries(
    projectId: number,
    branchName: string,
    domain: WorktreeJournalDomain,
    entityId: string,
    limit: number,
  ): WorktreeJournalEntryRecord[] {
    const rows = this.#db
      .prepare(
        `
          SELECT
            entry.project_id,
            entry.branch_name,
            entry.entry_id,
            entry.created_at,
            entry.updated_at,
            entry.worktree_revision,
            entry.actor,
            entry.source,
            entry.title,
            entry.kind,
            entry.domain,
            entry.entity_id,
            entry.entity_kind,
            entry.label,
            entry.display_path,
            entry.previous_label,
            entry.previous_path,
            entry.before_blob_id,
            entry.after_blob_id,
            entry.stats_added,
            entry.stats_removed,
            entry.commit_hash,
            entry.group_key,
            entry.metadata_json,
            before_blob.content AS before_content,
            after_blob.content AS after_content
          FROM worktree_journal_entry entry
          LEFT JOIN worktree_blob before_blob
            ON before_blob.project_id = entry.project_id
            AND before_blob.blob_id = entry.before_blob_id
          LEFT JOIN worktree_blob after_blob
            ON after_blob.project_id = entry.project_id
            AND after_blob.blob_id = entry.after_blob_id
          WHERE
            entry.project_id = ?
            AND entry.branch_name = ?
            AND entry.domain = ?
            AND entry.entity_id = ?
          ORDER BY entry.updated_at DESC, entry.worktree_revision DESC, entry.entry_id DESC
          LIMIT ?
        `,
      )
      .all(projectId, branchName, domain, entityId, limit) as WorktreeJournalEntrySqlRow[];
    return rows.map(rowToJournalEntryRecord);
  }

  getJournalHistoryEntry(
    projectId: number,
    branchName: string,
    entryId: string,
  ): WorktreeJournalEntryRecord | null {
    const row = this.#db
      .prepare(
        `
          SELECT
            entry.project_id,
            entry.branch_name,
            entry.entry_id,
            entry.created_at,
            entry.updated_at,
            entry.worktree_revision,
            entry.actor,
            entry.source,
            entry.title,
            entry.kind,
            entry.domain,
            entry.entity_id,
            entry.entity_kind,
            entry.label,
            entry.display_path,
            entry.previous_label,
            entry.previous_path,
            entry.before_blob_id,
            entry.after_blob_id,
            entry.stats_added,
            entry.stats_removed,
            entry.commit_hash,
            entry.group_key,
            entry.metadata_json,
            before_blob.content AS before_content,
            after_blob.content AS after_content
          FROM worktree_journal_entry entry
          LEFT JOIN worktree_blob before_blob
            ON before_blob.project_id = entry.project_id
            AND before_blob.blob_id = entry.before_blob_id
          LEFT JOIN worktree_blob after_blob
            ON after_blob.project_id = entry.project_id
            AND after_blob.blob_id = entry.after_blob_id
          WHERE
            entry.project_id = ?
            AND entry.branch_name = ?
            AND entry.entry_id = ?
        `,
      )
      .get(projectId, branchName, entryId) as WorktreeJournalEntrySqlRow | undefined;
    return row == null ? null : rowToJournalEntryRecord(row);
  }

  getMergeableJournalEntry(
    projectId: number,
    branchName: string,
    domain: WorktreeJournalDomain,
    entityId: string,
    source: WorktreeJournalSource,
    kind: WorktreeJournalOperationKind,
    groupKey: string,
    minUpdatedAt: number,
  ): WorktreeJournalEntryRecord | null {
    const row = this.#db
      .prepare(
        `
          SELECT
            entry.project_id,
            entry.branch_name,
            entry.entry_id,
            entry.created_at,
            entry.updated_at,
            entry.worktree_revision,
            entry.actor,
            entry.source,
            entry.title,
            entry.kind,
            entry.domain,
            entry.entity_id,
            entry.entity_kind,
            entry.label,
            entry.display_path,
            entry.previous_label,
            entry.previous_path,
            entry.before_blob_id,
            entry.after_blob_id,
            entry.stats_added,
            entry.stats_removed,
            entry.commit_hash,
            entry.group_key,
            entry.metadata_json,
            before_blob.content AS before_content,
            after_blob.content AS after_content
          FROM worktree_journal_entry entry
          LEFT JOIN worktree_blob before_blob
            ON before_blob.project_id = entry.project_id
            AND before_blob.blob_id = entry.before_blob_id
          LEFT JOIN worktree_blob after_blob
            ON after_blob.project_id = entry.project_id
            AND after_blob.blob_id = entry.after_blob_id
          WHERE
            entry.project_id = ?
            AND entry.branch_name = ?
            AND entry.domain = ?
            AND entry.entity_id = ?
          ORDER BY entry.updated_at DESC, entry.worktree_revision DESC, entry.entry_id DESC
          LIMIT 1
        `,
      )
      .get(projectId, branchName, domain, entityId) as WorktreeJournalEntrySqlRow | undefined;
    if (
      row == null ||
      row.source !== source ||
      row.kind !== kind ||
      row.group_key !== groupKey ||
      row.updated_at < minUpdatedAt
    ) {
      return null;
    }
    return rowToJournalEntryRecord(row);
  }

  insertJournalEntries(entries: readonly WorktreeJournalEntryRecord[]): void {
    const insertStmt = this.#db.prepare(
      `
        INSERT INTO worktree_journal_entry (
          project_id,
          branch_name,
          entry_id,
          created_at,
          updated_at,
          worktree_revision,
          actor,
          source,
          title,
          kind,
          domain,
          entity_id,
          entity_kind,
          label,
          display_path,
          previous_label,
          previous_path,
          before_blob_id,
          after_blob_id,
          stats_added,
          stats_removed,
          commit_hash,
          group_key,
          metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    for (const entry of entries) {
      insertStmt.run(
        entry.projectId,
        entry.branchName,
        entry.entryId,
        entry.createdAt,
        entry.updatedAt,
        entry.worktreeRevision,
        entry.actor,
        entry.source,
        entry.title,
        entry.kind,
        entry.domain,
        entry.entityId,
        entry.entityKind,
        entry.label,
        entry.displayPath,
        entry.previousLabel,
        entry.previousPath,
        entry.beforeBlobId,
        entry.afterBlobId,
        entry.statsAdded,
        entry.statsRemoved,
        entry.commitHash,
        entry.groupKey,
        entry.metadataJson,
      );
    }
  }

  updateJournalEntryAfterContent(
    entry: Pick<
      WorktreeJournalEntryRecord,
      | "projectId"
      | "branchName"
      | "entryId"
      | "updatedAt"
      | "worktreeRevision"
      | "label"
      | "displayPath"
      | "afterBlobId"
      | "statsAdded"
      | "statsRemoved"
    >,
  ): void {
    this.#db
      .prepare(
        `
          UPDATE worktree_journal_entry
          SET
            updated_at = ?,
            worktree_revision = ?,
            label = ?,
            display_path = ?,
            after_blob_id = ?,
            stats_added = ?,
            stats_removed = ?
          WHERE project_id = ? AND branch_name = ? AND entry_id = ?
        `,
      )
      .run(
        entry.updatedAt,
        entry.worktreeRevision,
        entry.label,
        entry.displayPath,
        entry.afterBlobId,
        entry.statsAdded,
        entry.statsRemoved,
        entry.projectId,
        entry.branchName,
        entry.entryId,
      );
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
    valueRows: ReadonlyArray<readonly SqlValue[]>,
  ): void {
    this.#db.prepare(deleteSql).run(projectId, branchName);
    const insertStmt = this.#db.prepare(insertSql);
    for (const row of valueRows) {
      insertStmt.run(...row);
    }
  }
}
