import { DatabaseSync } from "node:sqlite";

import type { ProjectRecord } from "../shared/project";

type ProjectRow = {
  id: number;
  path: string;
  last_opened_at: number;
};

function rowToRecord(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    path: row.path,
    lastOpenedAt: row.last_opened_at,
  };
}

export class ProjectsDatabase {
  readonly #db: DatabaseSync;

  constructor(dbPath: string) {
    this.#db = new DatabaseSync(dbPath);
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        last_opened_at INTEGER NOT NULL
      );
    `);
  }

  list(): ProjectRecord[] {
    const rows = this.#db
      .prepare(
        `SELECT id, path, last_opened_at FROM projects ORDER BY last_opened_at DESC`,
      )
      .all() as ProjectRow[];

    return rows.map(rowToRecord);
  }

  upsertByPath(absolutePath: string, lastOpenedAt: number): ProjectRecord {
    this.#db
      .prepare(
        `
        INSERT INTO projects (path, last_opened_at)
        VALUES (?, ?)
        ON CONFLICT(path) DO UPDATE SET last_opened_at = excluded.last_opened_at
        `,
      )
      .run(absolutePath, lastOpenedAt);

    const row = this.#db
      .prepare(`SELECT id, path, last_opened_at FROM projects WHERE path = ?`)
      .get(absolutePath) as ProjectRow | undefined;

    if (!row) {
      throw new Error(`Failed to upsert project at ${absolutePath}`);
    }

    return rowToRecord(row);
  }

  touchById(id: number, lastOpenedAt: number): ProjectRecord | null {
    this.#db
      .prepare(`UPDATE projects SET last_opened_at = ? WHERE id = ?`)
      .run(lastOpenedAt, id);

    const row = this.#db
      .prepare(`SELECT id, path, last_opened_at FROM projects WHERE id = ?`)
      .get(id) as ProjectRow | undefined;

    return row ? rowToRecord(row) : null;
  }

  close() {
    this.#db.close();
  }
}