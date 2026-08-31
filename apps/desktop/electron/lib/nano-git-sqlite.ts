import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import type { Repository } from "nano-git/repository/core";
import { createSqliteRepository } from "nano-git/repository/sqlite";
import type { SqliteDatabase, SqliteStatement, SqliteValue } from "nano-git/types/sqlite";

export type OpenedSqliteGitRepository = {
  readonly repo: Repository;
  [Symbol.dispose](): void;
};

/**
 * Wrap `node:sqlite` `DatabaseSync` as nano-git's bun-style `SqliteDatabase`.
 *
 * `get()` maps a missing row to `null` (nano-git `exists()` uses `!== null`).
 */
export function adaptNodeSqlite(db: DatabaseSync): SqliteDatabase {
  let txDepth = 0;
  let savepointSeq = 0;

  return {
    run(sql: string, params?: readonly SqliteValue[]): unknown {
      if (params === undefined || params.length === 0) {
        db.exec(sql);
        return undefined;
      }
      return db.prepare(sql).run(...toSqlParams(params));
    },

    query<TRow = unknown>(sql: string): SqliteStatement<TRow> {
      const stmt = db.prepare(sql);
      return {
        get(...params: SqliteValue[]): TRow | null {
          return (stmt.get(...toSqlParams(params)) as TRow | undefined) ?? null;
        },
        all(...params: SqliteValue[]): TRow[] {
          return stmt.all(...toSqlParams(params)) as TRow[];
        },
        run(...params: SqliteValue[]): unknown {
          return stmt.run(...toSqlParams(params));
        },
      };
    },

    transaction<TArgs extends unknown[], TResult>(
      fn: (...args: TArgs) => TResult,
    ): (...args: TArgs) => TResult {
      return (...args: TArgs): TResult => {
        if (txDepth > 0) {
          const name = `ng_${++savepointSeq}`;
          db.exec(`SAVEPOINT ${name}`);
          try {
            const result = fn(...args);
            db.exec(`RELEASE ${name}`);
            return result;
          } catch (error) {
            db.exec(`ROLLBACK TO ${name}`);
            db.exec(`RELEASE ${name}`);
            throw error;
          }
        }

        db.exec("BEGIN");
        txDepth += 1;
        try {
          const result = fn(...args);
          db.exec("COMMIT");
          return result;
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        } finally {
          txDepth -= 1;
        }
      };
    },
  };
}

export function openSqliteGitRepository(dbPath: string): OpenedSqliteGitRepository {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA busy_timeout = 5000;");
    const repo = createSqliteRepository(adaptNodeSqlite(db));
    let closed = false;
    return {
      repo,
      [Symbol.dispose](): void {
        if (closed) {
          return;
        }
        closed = true;
        db[Symbol.dispose]();
      },
    };
  } catch (error) {
    db[Symbol.dispose]();
    throw error;
  }
}

function toSqlParams(params: readonly SqliteValue[]): SQLInputValue[] {
  return params.map((value) => (typeof value === "boolean" ? (value ? 1 : 0) : value));
}
