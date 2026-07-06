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

export type WorktreeJournalDomain = "manuscript" | "resource";
export type WorktreeJournalSource =
  | "autosave"
  | "manual-checkpoint"
  | "structure-edit"
  | "restore"
  | "commit"
  | "import";
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

export type WorktreeJournalRevisionRecord = {
  projectId: number;
  branchName: string;
  revisionId: string;
  parentRevisionId: string | null;
  createdAt: number;
  worktreeRevision: number;
  actor: WorktreeJournalActor;
  source: WorktreeJournalSource;
  title: string;
  commitHash: string | null;
  groupId: string | null;
};

export type WorktreeJournalOperationRecord = {
  projectId: number;
  branchName: string;
  revisionId: string;
  operationId: string;
  orderIndex: number;
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
  metadataJson: string | null;
};

export type WorktreeJournalEntryRecord = WorktreeJournalRevisionRecord &
  WorktreeJournalOperationRecord & {
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

type WorktreeJournalRevisionSqlRow = {
  project_id: number;
  branch_name: string;
  revision_id: string;
  parent_revision_id: string | null;
  created_at: number;
  worktree_revision: number;
  actor: WorktreeJournalActor;
  source: WorktreeJournalSource;
  title: string;
  commit_hash: string | null;
  group_id: string | null;
};

type WorktreeJournalOperationSqlRow = {
  project_id: number;
  branch_name: string;
  revision_id: string;
  operation_id: string;
  order_index: number;
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
  metadata_json: string | null;
};

type WorktreeJournalEntrySqlRow = WorktreeJournalRevisionSqlRow &
  WorktreeJournalOperationSqlRow & {
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

function rowToJournalRevisionRecord(
  row: WorktreeJournalRevisionSqlRow,
): WorktreeJournalRevisionRecord {
  return {
    projectId: row.project_id,
    branchName: row.branch_name,
    revisionId: row.revision_id,
    parentRevisionId: row.parent_revision_id,
    createdAt: row.created_at,
    worktreeRevision: row.worktree_revision,
    actor: row.actor,
    source: row.source,
    title: row.title,
    commitHash: row.commit_hash,
    groupId: row.group_id,
  };
}

function rowToJournalOperationRecord(
  row: WorktreeJournalOperationSqlRow,
): WorktreeJournalOperationRecord {
  return {
    projectId: row.project_id,
    branchName: row.branch_name,
    revisionId: row.revision_id,
    operationId: row.operation_id,
    orderIndex: row.order_index,
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
    metadataJson: row.metadata_json,
  };
}

function rowToJournalEntryRecord(row: WorktreeJournalEntrySqlRow): WorktreeJournalEntryRecord {
  return {
    ...rowToJournalRevisionRecord(row),
    ...rowToJournalOperationRecord(row),
    beforeContent: toBuffer(row.before_content),
    afterContent: toBuffer(row.after_content),
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

  readJournalTimelineEntries(
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
            revision.project_id,
            revision.branch_name,
            revision.revision_id,
            revision.parent_revision_id,
            revision.created_at,
            revision.worktree_revision,
            revision.actor,
            revision.source,
            revision.title,
            revision.commit_hash,
            revision.group_id,
            operation.operation_id,
            operation.order_index,
            operation.kind,
            operation.domain,
            operation.entity_id,
            operation.entity_kind,
            operation.label,
            operation.display_path,
            operation.previous_label,
            operation.previous_path,
            operation.before_blob_id,
            operation.after_blob_id,
            operation.stats_added,
            operation.stats_removed,
            operation.metadata_json,
            before_blob.content AS before_content,
            after_blob.content AS after_content
          FROM worktree_journal_operation operation
          INNER JOIN worktree_journal_revision revision
            ON revision.project_id = operation.project_id
            AND revision.branch_name = operation.branch_name
            AND revision.revision_id = operation.revision_id
          LEFT JOIN worktree_blob before_blob
            ON before_blob.project_id = operation.project_id
            AND before_blob.blob_id = operation.before_blob_id
          LEFT JOIN worktree_blob after_blob
            ON after_blob.project_id = operation.project_id
            AND after_blob.blob_id = operation.after_blob_id
          WHERE
            operation.project_id = ?
            AND operation.branch_name = ?
            AND operation.domain = ?
            AND operation.entity_id = ?
          ORDER BY revision.created_at DESC, revision.worktree_revision DESC, operation.order_index DESC
          LIMIT ?
        `,
      )
      .all(projectId, branchName, domain, entityId, limit) as WorktreeJournalEntrySqlRow[];
    return rows.map(rowToJournalEntryRecord);
  }

  readPendingJournalEntries(projectId: number, branchName: string): WorktreeJournalEntryRecord[] {
    const rows = this.#db
      .prepare(
        `
          WITH latest_commit AS (
            SELECT worktree_revision
            FROM worktree_journal_revision
            WHERE project_id = ? AND branch_name = ? AND source = 'commit'
            ORDER BY worktree_revision DESC, created_at DESC, revision_id DESC
            LIMIT 1
          )
          SELECT
            revision.project_id,
            revision.branch_name,
            revision.revision_id,
            revision.parent_revision_id,
            revision.created_at,
            revision.worktree_revision,
            revision.actor,
            revision.source,
            revision.title,
            revision.commit_hash,
            revision.group_id,
            operation.operation_id,
            operation.order_index,
            operation.kind,
            operation.domain,
            operation.entity_id,
            operation.entity_kind,
            operation.label,
            operation.display_path,
            operation.previous_label,
            operation.previous_path,
            operation.before_blob_id,
            operation.after_blob_id,
            operation.stats_added,
            operation.stats_removed,
            operation.metadata_json,
            before_blob.content AS before_content,
            after_blob.content AS after_content
          FROM worktree_journal_operation operation
          INNER JOIN worktree_journal_revision revision
            ON revision.project_id = operation.project_id
            AND revision.branch_name = operation.branch_name
            AND revision.revision_id = operation.revision_id
          LEFT JOIN worktree_blob before_blob
            ON before_blob.project_id = operation.project_id
            AND before_blob.blob_id = operation.before_blob_id
          LEFT JOIN worktree_blob after_blob
            ON after_blob.project_id = operation.project_id
            AND after_blob.blob_id = operation.after_blob_id
          WHERE
            operation.project_id = ?
            AND operation.branch_name = ?
            AND revision.source <> 'commit'
            AND revision.worktree_revision > COALESCE(
              (SELECT worktree_revision FROM latest_commit),
              -1
            )
          ORDER BY revision.worktree_revision ASC, revision.created_at ASC, operation.order_index ASC
        `,
      )
      .all(projectId, branchName, projectId, branchName) as WorktreeJournalEntrySqlRow[];
    return rows.map(rowToJournalEntryRecord);
  }

  getJournalTimelineEntry(
    projectId: number,
    branchName: string,
    revisionId: string,
    operationId: string,
  ): WorktreeJournalEntryRecord | null {
    const row = this.#db
      .prepare(
        `
          SELECT
            revision.project_id,
            revision.branch_name,
            revision.revision_id,
            revision.parent_revision_id,
            revision.created_at,
            revision.worktree_revision,
            revision.actor,
            revision.source,
            revision.title,
            revision.commit_hash,
            revision.group_id,
            operation.operation_id,
            operation.order_index,
            operation.kind,
            operation.domain,
            operation.entity_id,
            operation.entity_kind,
            operation.label,
            operation.display_path,
            operation.previous_label,
            operation.previous_path,
            operation.before_blob_id,
            operation.after_blob_id,
            operation.stats_added,
            operation.stats_removed,
            operation.metadata_json,
            before_blob.content AS before_content,
            after_blob.content AS after_content
          FROM worktree_journal_operation operation
          INNER JOIN worktree_journal_revision revision
            ON revision.project_id = operation.project_id
            AND revision.branch_name = operation.branch_name
            AND revision.revision_id = operation.revision_id
          LEFT JOIN worktree_blob before_blob
            ON before_blob.project_id = operation.project_id
            AND before_blob.blob_id = operation.before_blob_id
          LEFT JOIN worktree_blob after_blob
            ON after_blob.project_id = operation.project_id
            AND after_blob.blob_id = operation.after_blob_id
          WHERE
            operation.project_id = ?
            AND operation.branch_name = ?
            AND operation.revision_id = ?
            AND operation.operation_id = ?
        `,
      )
      .get(projectId, branchName, revisionId, operationId) as
      | WorktreeJournalEntrySqlRow
      | undefined;
    return row === undefined ? null : rowToJournalEntryRecord(row);
  }

  recordJournalRevision(
    revision: WorktreeJournalRevisionRecord,
    operations: readonly WorktreeJournalOperationRecord[],
  ): void {
    if (operations.length === 0) {
      return;
    }

    const latest =
      revision.parentRevisionId ??
      this.#readLatestJournalRevisionId(revision.projectId, revision.branchName);

    this.#db
      .prepare(
        `
          INSERT INTO worktree_journal_revision (
            project_id,
            branch_name,
            revision_id,
            parent_revision_id,
            created_at,
            worktree_revision,
            actor,
            source,
            title,
            commit_hash,
            group_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        revision.projectId,
        revision.branchName,
        revision.revisionId,
        latest,
        revision.createdAt,
        revision.worktreeRevision,
        revision.actor,
        revision.source,
        revision.title,
        revision.commitHash,
        revision.groupId,
      );

    const operationStmt = this.#db.prepare(
      `
        INSERT INTO worktree_journal_operation (
          project_id,
          branch_name,
          revision_id,
          operation_id,
          order_index,
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
          metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );
    for (const operation of operations) {
      operationStmt.run(
        operation.projectId,
        operation.branchName,
        operation.revisionId,
        operation.operationId,
        operation.orderIndex,
        operation.kind,
        operation.domain,
        operation.entityId,
        operation.entityKind,
        operation.label,
        operation.displayPath,
        operation.previousLabel,
        operation.previousPath,
        operation.beforeBlobId,
        operation.afterBlobId,
        operation.statsAdded,
        operation.statsRemoved,
        operation.metadataJson,
      );
    }
  }

  #readLatestJournalRevisionId(projectId: number, branchName: string): string | null {
    const row = this.#db
      .prepare(
        `
          SELECT revision_id
          FROM worktree_journal_revision
          WHERE project_id = ? AND branch_name = ?
          ORDER BY created_at DESC, worktree_revision DESC, revision_id DESC
          LIMIT 1
        `,
      )
      .get(projectId, branchName) as { revision_id: string } | undefined;
    return row?.revision_id ?? null;
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
