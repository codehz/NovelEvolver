import type { DatabaseSync } from "node:sqlite";

/** projects 表 schema。被 worktree 表通过 FK 引用，需先初始化。 */
export function initProjectsSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      last_opened_at INTEGER NOT NULL,
      remote_url TEXT
    );
  `);

  const columns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "remote_url")) {
    db.exec("ALTER TABLE projects ADD COLUMN remote_url TEXT");
  }
}
