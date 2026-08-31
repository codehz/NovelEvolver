import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import type { DatabasePort, SqlValue } from "@novelevolver/worktree";

export function asNodeSqlitePort(db: DatabaseSync): DatabasePort {
  return {
    exec(sql: string): void {
      db.exec(sql);
    },
    prepare(sql: string) {
      const statement = db.prepare(sql);
      return {
        run(...params: SqlValue[]) {
          const result = statement.run(...(params as SQLInputValue[]));
          return { changes: Number(result.changes) };
        },
        get(...params: SqlValue[]) {
          return statement.get(...(params as SQLInputValue[]));
        },
        all(...params: SqlValue[]) {
          return statement.all(...(params as SQLInputValue[]));
        },
      };
    },
  };
}
