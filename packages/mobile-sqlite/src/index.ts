import { NitroSQLite, NitroSQLiteError, open, type SQLiteValue } from "react-native-nitro-sqlite";

export type SQLQueryBinding =
  | string
  | bigint
  | ArrayBufferView
  | number
  | boolean
  | null
  | Record<string, string | bigint | ArrayBufferView | number | boolean | null>;

export type SQLQueryBindings = SQLQueryBinding[];

export type DatabaseOptions = {
  readonly?: boolean;
  create?: boolean;
  readwrite?: boolean;
  safeIntegers?: boolean;
  strict?: boolean;
  location?: string;
};

export type Changes = {
  changes: number;
  lastInsertRowid: number | bigint;
};

export class SQLiteError extends Error {
  readonly name = "SQLiteError";
  readonly errno = 0;
  readonly byteOffset = -1;
  readonly code?: string;

  constructor(cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(message);
    this.code = undefined;
    this.cause = cause;
  }
}

function unsupported(feature: string): never {
  throw new TypeError(`${feature} is not supported by @novelevolver/mobile-sqlite`);
}

function toArrayBuffer(value: ArrayBufferView | ArrayBuffer): ArrayBuffer {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function convertBinding(value: SQLQueryBinding): SQLiteValue {
  if (typeof value === "bigint") {
    unsupported("bigint bindings");
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return toArrayBuffer(value);
  }
  if (value !== null && typeof value === "object") {
    unsupported("named bindings");
  }
  return value;
}

function normalizeBindings(bindings: SQLQueryBinding[]): SQLiteValue[] {
  if (bindings.length === 1 && Array.isArray(bindings[0])) {
    return normalizeBindings(bindings[0]);
  }
  return bindings.map(convertBinding);
}

function countParameters(sql: string): number {
  let count = 0;
  let index = 0;

  while (index < sql.length) {
    const current = sql[index];
    const next = sql[index + 1];

    if (current === "'" || current === '"' || current === "`") {
      const quote = current;
      index += 1;
      while (index < sql.length) {
        if (sql[index] === quote) {
          if (sql[index + 1] === quote && quote !== "`") {
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    if (current === "-" && next === "-") {
      index += 2;
      while (index < sql.length && sql[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      while (index < sql.length) {
        if (sql[index] === "*" && sql[index + 1] === "/") {
          index += 2;
          break;
        }
        index += 1;
      }
      continue;
    }

    if (current === "?") {
      count += 1;
      index += 1;
      while (/\d/.test(sql[index] ?? "")) {
        index += 1;
      }
      continue;
    }

    index += 1;
  }

  return count;
}

function wrapError(error: unknown): unknown {
  if (error instanceof SQLiteError) {
    return error;
  }
  if (error instanceof NitroSQLiteError) {
    return new SQLiteError(error);
  }
  return error;
}

type NitroConnection = ReturnType<typeof open>;

export class Statement<
  ReturnType extends Record<string, SQLiteValue> = Record<string, SQLiteValue>,
> {
  readonly native = null;
  #connection: NitroConnection;
  #sql: string;
  #bound: SQLQueryBinding[];
  #finalized = false;

  constructor(connection: NitroConnection, sql: string, initialBindings: SQLQueryBinding[] = []) {
    this.#connection = connection;
    this.#sql = sql;
    this.#bound = initialBindings;
  }

  #ensureOpen(): void {
    if (this.#finalized) {
      throw new Error("Statement has been finalized");
    }
  }

  #bindings(params: SQLQueryBinding[]): SQLiteValue[] {
    const bindings = params.length > 0 ? params : this.#bound;
    if (params.length > 0) {
      this.#bound = params;
    }
    return normalizeBindings(bindings);
  }

  #execute(params: SQLQueryBinding[]): {
    results: ReturnType[];
    rowsAffected: number;
    insertId?: number;
  } {
    this.#ensureOpen();
    try {
      const result = this.#connection.execute<ReturnType>(this.#sql, this.#bindings(params));
      return {
        results: result.results as ReturnType[],
        rowsAffected: result.rowsAffected,
        insertId: result.insertId,
      };
    } catch (error) {
      throw wrapError(error);
    }
  }

  all(...params: SQLQueryBinding[]): ReturnType[] {
    return this.#execute(params).results;
  }

  get(...params: SQLQueryBinding[]): ReturnType | null {
    return this.#execute(params).results[0] ?? null;
  }

  iterate(...params: SQLQueryBinding[]): IterableIterator<ReturnType> {
    return this.all(...params)[Symbol.iterator]();
  }

  run(...params: SQLQueryBinding[]): Changes {
    const result = this.#execute(params);
    return {
      changes: result.rowsAffected,
      lastInsertRowid: result.insertId ?? 0,
    };
  }

  values(
    ...params: SQLQueryBinding[]
  ): Array<Array<string | number | boolean | Uint8Array | null>> {
    return this.all(...params).map(
      (row) => Object.values(row) as Array<string | number | boolean | Uint8Array | null>,
    );
  }

  get columnNames(): string[] {
    return [];
  }

  get paramsCount(): number {
    return countParameters(this.#sql);
  }

  get columnTypes(): Array<"INTEGER" | "FLOAT" | "TEXT" | "BLOB" | "NULL" | null> {
    return this.columnNames.map(() => null);
  }

  get declaredTypes(): Array<string | null> {
    return this.columnNames.map(() => null);
  }

  finalize(): void {
    this.#finalized = true;
  }

  [Symbol.iterator](): IterableIterator<ReturnType> {
    return this.iterate();
  }

  [Symbol.dispose](): void {
    this.finalize();
  }
}

function resolveDatabaseName(filename: string): string {
  if (filename === ":memory:") {
    return `:memory:${Math.random().toString(36).slice(2)}`;
  }

  const normalized = filename.replaceAll("\\", "/");
  if (normalized.includes("/") || normalized.startsWith(".")) {
    throw new TypeError(
      "Mobile SQLite database names must be relative filenames; pass the directory through DatabaseOptions.location.",
    );
  }
  return normalized;
}

function normalizeOptions(options: number | DatabaseOptions | undefined): {
  readonly: boolean;
  location?: string;
} {
  if (options === undefined) {
    return { readonly: false };
  }
  if (typeof options === "number") {
    return {
      readonly: (options & constants.SQLITE_OPEN_READONLY) !== 0,
    };
  }
  if (options.create === false && options.readonly !== true) {
    unsupported("DatabaseOptions.create=false without readonly");
  }
  if (options.safeIntegers) {
    unsupported("DatabaseOptions.safeIntegers");
  }
  return {
    readonly: options.readonly ?? false,
    location: options.location,
  };
}

export class Database {
  static open(filename: string, options?: number | DatabaseOptions): Database {
    return new Database(filename, options);
  }

  #connection: NitroConnection;
  #queries = new Map<string, Statement>();
  #statements = new Set<{ finalize(): void }>();
  #savepointId = 0;
  #closed = false;
  #memoryDatabase = false;
  #transactionDepth = 0;
  readonly filename: string;

  constructor(filename = ":memory:", options?: number | DatabaseOptions) {
    const normalized = normalizeOptions(options);
    this.#memoryDatabase = filename === ":memory:";
    this.filename = filename;

    try {
      const name = resolveDatabaseName(filename);
      this.#connection = open({ name, location: normalized.location });
      if (normalized.readonly) {
        this.#connection.execute("PRAGMA query_only = ON");
      }
    } catch (error) {
      throw wrapError(error);
    }
  }

  run(sql: string, ...bindings: SQLQueryBinding[]): Changes {
    const statement = this.prepare(sql);
    try {
      return statement.run(...bindings);
    } finally {
      statement.finalize();
    }
  }

  exec(sql: string, ...bindings: SQLQueryBinding[]): Changes {
    return this.run(sql, ...bindings);
  }

  query<ReturnType extends Record<string, SQLiteValue> = Record<string, SQLiteValue>>(
    sql: string,
  ): Statement<ReturnType> {
    this.#ensureOpen();
    let statement = this.#queries.get(sql) as Statement<ReturnType> | undefined;
    if (statement === undefined) {
      statement = new Statement<ReturnType>(this.#connection, sql);
      this.#queries.set(sql, statement);
      this.#statements.add(statement);
    }
    return statement;
  }

  prepare<ReturnType extends Record<string, SQLiteValue> = Record<string, SQLiteValue>>(
    sql: string,
    params?: SQLQueryBinding[] | SQLQueryBinding,
  ): Statement<ReturnType> {
    this.#ensureOpen();
    const initialBindings: SQLQueryBinding[] =
      params === undefined ? [] : Array.isArray(params) ? params : [params];
    const statement = new Statement<ReturnType>(this.#connection, sql, initialBindings);
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

      this.#connection.execute(start);
      this.#transactionDepth += 1;
      try {
        const result = insideTransaction(...args);
        this.#connection.execute(finish);
        return result;
      } catch (error) {
        try {
          this.#connection.execute(revert);
          if (nested) {
            this.#connection.execute(`RELEASE SAVEPOINT ${savepoint}`);
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
    if (this.#memoryDatabase) {
      this.#connection.delete();
    } else {
      this.#connection.close();
    }
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

export const constants = {
  SQLITE_OPEN_READONLY: 0x00000001,
  SQLITE_OPEN_READWRITE: 0x00000002,
  SQLITE_OPEN_CREATE: 0x00000004,
};

export const native = NitroSQLite.native;

export { open };
export default Database;
