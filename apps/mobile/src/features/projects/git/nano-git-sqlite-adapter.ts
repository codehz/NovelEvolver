import type { Database } from "@novelevolver/mobile-sqlite";
import type { SqliteDatabase, SqliteStatement, SqliteValue } from "nano-git/types/sqlite";

type MobileDatabase = Pick<Database, "run" | "query" | "transaction">;

function convertValue(value: SqliteValue): string | number | null | Uint8Array {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" || typeof value === "number" || value === null) return value;
  return value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer);
}

export function adaptMobileSqlite(db: MobileDatabase): SqliteDatabase {
  return {
    run(sql: string, params = []) {
      return db.run(sql, ...params.map(convertValue));
    },
    query<TRow = unknown>(sql: string): SqliteStatement<TRow> {
      const statement = db.query(sql) as unknown as SqliteStatement<TRow>;
      return {
        get(...params) {
          return statement.get(...params.map(convertValue));
        },
        all(...params) {
          return statement.all(...params.map(convertValue));
        },
        run(...params) {
          return statement.run(...params.map(convertValue));
        },
      };
    },
    transaction<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult) {
      return (...args: TArgs) => db.transaction(fn)(...args);
    },
  };
}
