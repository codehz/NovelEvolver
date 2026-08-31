export type SqlValue = string | number | bigint | boolean | null | Uint8Array;

export type SqlRunResult = {
  changes: number;
};

export type SqlStatement = {
  run(...params: SqlValue[]): SqlRunResult;
  get(...params: SqlValue[]): unknown;
  all(...params: SqlValue[]): unknown[];
};

export type DatabasePort = {
  /** Execute one SQL statement. Drivers such as the mobile SQLite module reject batches. */
  exec(sql: string): void;
  prepare(sql: string): SqlStatement;
};
