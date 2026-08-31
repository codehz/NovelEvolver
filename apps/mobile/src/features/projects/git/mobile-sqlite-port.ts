import type { Database } from "@novelevolver/mobile-sqlite";
import type { DatabasePort, SqlValue } from "@novelevolver/worktree";

export function asMobileSqlitePort(db: Database): DatabasePort {
  return {
    exec(sql: string): void {
      db.exec(sql);
    },
    prepare(sql: string) {
      const statement = db.prepare(sql);
      return {
        run(...params: SqlValue[]) {
          return statement.run(...params);
        },
        get(...params: SqlValue[]) {
          return statement.get(...params);
        },
        all(...params: SqlValue[]) {
          return statement.all(...params);
        },
      };
    },
  };
}
