import type { DatabaseSync } from "node:sqlite";

type ProjectRow = {
  id: number;
  path: string;
  last_opened_at: number;
};

export type ProjectDbRecord = {
  id: number;
  path: string;
  lastOpenedAt: number;
};

function rowToRecord(row: ProjectRow): ProjectDbRecord {
  return {
    id: row.id,
    path: row.path,
    lastOpenedAt: row.last_opened_at,
  };
}

/**
 * projects 表的 query 接口。
 *
 * 不负责建表（schema 由 initProjectsSchema 在 AppDatabase 启动时执行），
 * 也不持有自己的连接，构造时注入共享 DatabaseSync 句柄。
 */
export class ProjectsRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  list(): ProjectDbRecord[] {
    const rows = this.#db
      .prepare(`SELECT id, path, last_opened_at FROM projects ORDER BY last_opened_at DESC`)
      .all() as ProjectRow[];

    return rows.map(rowToRecord);
  }

  getById(id: number): ProjectDbRecord | null {
    const row = this.#db
      .prepare(`SELECT id, path, last_opened_at FROM projects WHERE id = ?`)
      .get(id) as ProjectRow | undefined;

    return row ? rowToRecord(row) : null;
  }

  upsertByPath(absolutePath: string, lastOpenedAt: number): ProjectDbRecord {
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

  touchById(id: number, lastOpenedAt: number): ProjectDbRecord | null {
    this.#db.prepare(`UPDATE projects SET last_opened_at = ? WHERE id = ?`).run(lastOpenedAt, id);

    const row = this.#db
      .prepare(`SELECT id, path, last_opened_at FROM projects WHERE id = ?`)
      .get(id) as ProjectRow | undefined;

    return row ? rowToRecord(row) : null;
  }

  removeById(id: number): boolean {
    const result = this.#db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
    return result.changes > 0;
  }
}
