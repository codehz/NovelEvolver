import type { DatabaseSync } from "node:sqlite";

/**
 * worktree 及其 manuscript / resource 节点表的 schema。
 *
 * 依赖 projects 表已存在（由 initProjectsSchema 先建），worktree.project_id
 * 通过 FK + ON DELETE CASCADE 引用 projects(id)，删项目时所有 worktree
 * 及子节点原子级联清理。
 */
export function initWorktreeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS worktree (
      project_id INTEGER NOT NULL,
      branch_name TEXT NOT NULL,
      base_commit_sha TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      warning TEXT,
      PRIMARY KEY (project_id, branch_name),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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
