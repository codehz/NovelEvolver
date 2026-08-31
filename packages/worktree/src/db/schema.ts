import type { DatabasePort } from "./database-port";

function execAll(db: DatabasePort, statements: readonly string[]): void {
  for (const sql of statements) {
    db.exec(sql);
  }
}

export function initProjectsSchema(db: DatabasePort): void {
  execAll(db, [
    `CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      last_opened_at INTEGER NOT NULL,
      remote_url TEXT,
      display_name TEXT
    )`,
  ]);

  const columns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "remote_url")) {
    db.exec("ALTER TABLE projects ADD COLUMN remote_url TEXT");
  }
  if (!columns.some((column) => column.name === "display_name")) {
    db.exec("ALTER TABLE projects ADD COLUMN display_name TEXT");
  }
}

/**
 * worktree 及其 manuscript / resource 节点表。
 *
 * 依赖 projects 表已存在（由 initProjectsSchema 先建），worktree.project_id
 * 通过 FK + ON DELETE CASCADE 引用 projects(id)。
 *
 * 每条 SQL 单独 exec：部分驱动（含移动端 SQLite 模块）一次只能跑一条语句。
 */
export function initWorktreeSchema(db: DatabasePort): void {
  execAll(db, [
    `CREATE TABLE IF NOT EXISTS worktree (
      project_id INTEGER NOT NULL,
      branch_name TEXT NOT NULL,
      base_commit_sha TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      warning TEXT,
      PRIMARY KEY (project_id, branch_name),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS manuscript_node_current (
      project_id INTEGER NOT NULL,
      branch_name TEXT NOT NULL,
      id TEXT NOT NULL,
      parent_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_index INTEGER NOT NULL,
      content BLOB,
      content_revision INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (project_id, branch_name, id),
      FOREIGN KEY (project_id, branch_name)
        REFERENCES worktree(project_id, branch_name) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS manuscript_node_committed (
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
    )`,
    `CREATE TABLE IF NOT EXISTS resource_node_current (
      project_id INTEGER NOT NULL,
      branch_name TEXT NOT NULL,
      id TEXT NOT NULL,
      parent_id TEXT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      content BLOB,
      content_revision INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (project_id, branch_name, id),
      FOREIGN KEY (project_id, branch_name)
        REFERENCES worktree(project_id, branch_name) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS resource_node_committed (
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
    )`,
    `DROP TABLE IF EXISTS worktree_journal_operation`,
    `DROP TABLE IF EXISTS worktree_journal_revision`,
    `CREATE TABLE IF NOT EXISTS worktree_blob (
      project_id INTEGER NOT NULL,
      blob_id TEXT NOT NULL,
      content_sha TEXT NOT NULL,
      content BLOB NOT NULL,
      PRIMARY KEY (project_id, blob_id),
      UNIQUE (project_id, content_sha),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS worktree_journal_entry (
      project_id INTEGER NOT NULL,
      branch_name TEXT NOT NULL,
      entry_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      worktree_revision INTEGER NOT NULL,
      actor TEXT NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      domain TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_kind TEXT NOT NULL,
      label TEXT NOT NULL,
      display_path TEXT NOT NULL,
      previous_label TEXT,
      previous_path TEXT,
      before_blob_id TEXT,
      after_blob_id TEXT,
      stats_added INTEGER,
      stats_removed INTEGER,
      commit_hash TEXT,
      group_key TEXT,
      metadata_json TEXT,
      PRIMARY KEY (project_id, branch_name, entry_id),
      FOREIGN KEY (project_id, branch_name)
        REFERENCES worktree(project_id, branch_name) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_manuscript_current_parent
      ON manuscript_node_current(project_id, branch_name, parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_manuscript_committed_parent
      ON manuscript_node_committed(project_id, branch_name, parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_resource_current_parent
      ON resource_node_current(project_id, branch_name, parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_resource_committed_parent
      ON resource_node_committed(project_id, branch_name, parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_worktree_journal_entry_branch
      ON worktree_journal_entry(project_id, branch_name, updated_at DESC, worktree_revision DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_worktree_journal_entry_entity
      ON worktree_journal_entry(project_id, branch_name, domain, entity_id, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_worktree_journal_entry_group
      ON worktree_journal_entry(project_id, branch_name, group_key, updated_at DESC)`,
  ]);

  ensureCurrentContentRevisionColumn(db, "manuscript_node_current");
  ensureCurrentContentRevisionColumn(db, "resource_node_current");
}

export function initAppState(db: DatabasePort): void {
  initProjectsSchema(db);
  initWorktreeSchema(db);
}

function ensureCurrentContentRevisionColumn(
  db: DatabasePort,
  tableName: "manuscript_node_current" | "resource_node_current",
): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  if (!columns.some((column) => column.name === "content_revision")) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN content_revision INTEGER NOT NULL DEFAULT 0`);
  }
}
