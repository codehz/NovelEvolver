import { NitroModules } from "react-native-nitro-modules";

import type { NativeSqlite } from "./NativeSqlite.nitro";
import {
  fromNativeResult,
  toNativeParams,
  type QueryRow,
  type QueryResult,
  type SqlValue,
} from "./values";

export type { QueryRow, QueryResult, SqlValue };
export {
  PROJECTS_LOCATION,
  deleteProjectFile,
  displayNameFromFile,
  importProjectFile,
  listProjectFiles,
  notifyProjectFilesChanged,
  projectFileExists,
  renameProjectFile,
  shareProjectFile,
  toProjectFileName,
} from "./project-files";

let nativeSqlite: NativeSqlite | undefined;

function getNativeSqlite(): NativeSqlite {
  nativeSqlite ??= NitroModules.createHybridObject<NativeSqlite>("NativeSqlite");
  return nativeSqlite;
}

export type DatabaseOptions = {
  readonly?: boolean;
  location?: string;
};

export type Changes = {
  changes: number;
  lastInsertRowid: number;
};

export class SQLiteError extends Error {
  readonly name = "SQLiteError";

  constructor(cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(message);
    this.cause = cause;
  }
}

function wrapError(error: unknown): unknown {
  if (error instanceof SQLiteError) {
    return error;
  }
  return new SQLiteError(error);
}

export class Statement<Row extends QueryRow = QueryRow> {
  #connectionId: number;
  #sql: string;
  #bound: SqlValue[];
  #finalized = false;

  constructor(connectionId: number, sql: string, initialBindings: SqlValue[] = []) {
    this.#connectionId = connectionId;
    this.#sql = sql;
    this.#bound = initialBindings;
  }

  #ensureOpen(): void {
    if (this.#finalized) {
      throw new Error("Statement has been finalized");
    }
  }

  #execute(params: SqlValue[]): QueryResult {
    this.#ensureOpen();
    const bindings = params.length > 0 ? params : this.#bound;
    if (params.length > 0) {
      this.#bound = bindings;
    }
    try {
      return fromNativeResult(
        getNativeSqlite().execute(this.#connectionId, this.#sql, toNativeParams(bindings)),
      );
    } catch (error) {
      throw wrapError(error);
    }
  }

  all(...params: SqlValue[]): Row[] {
    return this.#execute(params).rows as Row[];
  }

  get(...params: SqlValue[]): Row | null {
    return (this.#execute(params).rows[0] as Row | undefined) ?? null;
  }

  run(...params: SqlValue[]): Changes {
    const result = this.#execute(params);
    return {
      changes: result.rowsAffected,
      lastInsertRowid: result.insertId,
    };
  }

  finalize(): void {
    this.#finalized = true;
  }

  [Symbol.dispose](): void {
    this.finalize();
  }
}

function resolveDatabaseName(filename: string): string {
  if (filename === ":memory:") {
    return filename;
  }
  const normalized = filename.replaceAll("\\", "/");
  if (normalized.includes("/") || normalized.startsWith(".")) {
    throw new TypeError(
      "Mobile SQLite database names must be relative filenames; pass the directory through DatabaseOptions.location.",
    );
  }
  return normalized;
}

export class Database {
  static open(filename: string, options?: DatabaseOptions): Database {
    return new Database(filename, options);
  }

  #connectionId: number;
  #queries = new Map<string, Statement>();
  #statements = new Set<Statement>();
  #savepointId = 0;
  #closed = false;
  #transactionDepth = 0;
  readonly filename: string;

  constructor(filename = ":memory:", options?: DatabaseOptions) {
    this.filename = filename;
    try {
      this.#connectionId = getNativeSqlite().open(
        resolveDatabaseName(filename),
        options?.location ?? "",
        options?.readonly ?? false,
      );
    } catch (error) {
      throw wrapError(error);
    }
  }

  run(sql: string, ...bindings: SqlValue[]): Changes {
    const statement = this.prepare(sql);
    try {
      return statement.run(...bindings);
    } finally {
      statement.finalize();
    }
  }

  exec(sql: string): void {
    this.run(sql);
  }

  query<Row extends QueryRow = QueryRow>(sql: string): Statement<Row> {
    this.#ensureOpen();
    let statement = this.#queries.get(sql) as Statement<Row> | undefined;
    if (statement === undefined) {
      statement = new Statement<Row>(this.#connectionId, sql);
      this.#queries.set(sql, statement);
      this.#statements.add(statement);
    }
    return statement;
  }

  prepare<Row extends QueryRow = QueryRow>(
    sql: string,
    params?: SqlValue[] | SqlValue,
  ): Statement<Row> {
    this.#ensureOpen();
    const initialBindings: SqlValue[] =
      params === undefined ? [] : Array.isArray(params) ? params : [params];
    const statement = new Statement<Row>(this.#connectionId, sql, initialBindings);
    this.#statements.add(statement);
    return statement;
  }

  get inTransaction(): boolean {
    return this.#transactionDepth > 0;
  }

  transaction<A extends unknown[], T>(
    insideTransaction: (...args: A) => T,
  ): {
    (...args: A): T;
    deferred: (...args: A) => T;
    immediate: (...args: A) => T;
    exclusive: (...args: A) => T;
  } {
    const runTransaction = (begin: string, args: A): T => {
      this.#ensureOpen();
      const nested = this.#transactionDepth > 0;
      const savepoint = `__mobile_sqlite_tx_${++this.#savepointId}`;
      const start = nested ? `SAVEPOINT ${savepoint}` : begin;
      const finish = nested ? `RELEASE SAVEPOINT ${savepoint}` : "COMMIT";
      const revert = nested ? `ROLLBACK TO SAVEPOINT ${savepoint}` : "ROLLBACK";

      this.exec(start);
      this.#transactionDepth += 1;
      try {
        const result = insideTransaction(...args);
        this.exec(finish);
        return result;
      } catch (error) {
        try {
          this.exec(revert);
          if (nested) {
            this.exec(`RELEASE SAVEPOINT ${savepoint}`);
          }
        } catch {
          // Preserve the original error if rollback also fails.
        }
        throw error;
      } finally {
        this.#transactionDepth -= 1;
      }
    };

    const execute = (...args: A): T => runTransaction("BEGIN", args);
    execute.deferred = (...args: A): T => runTransaction("BEGIN DEFERRED", args);
    execute.immediate = (...args: A): T => runTransaction("BEGIN IMMEDIATE", args);
    execute.exclusive = (...args: A): T => runTransaction("BEGIN EXCLUSIVE", args);
    return execute;
  }

  close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    for (const statement of this.#statements) {
      statement.finalize();
    }
    this.#statements.clear();
    this.#queries.clear();
    getNativeSqlite().close(this.#connectionId);
  }

  [Symbol.dispose](): void {
    this.close();
  }

  #ensureOpen(): void {
    if (this.#closed) {
      throw new Error("Database is closed");
    }
  }
}
