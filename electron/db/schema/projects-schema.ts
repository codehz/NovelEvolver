import type { DatabaseSync } from "node:sqlite";

/** projects 表 schema。被 worktree 表通过 FK 引用，需先初始化。 */
export function initProjectsSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      last_opened_at INTEGER NOT NULL
    );
  `);
}
