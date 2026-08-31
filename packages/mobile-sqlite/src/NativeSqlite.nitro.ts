import type { HybridObject } from "react-native-nitro-modules";

export type SqlValue = string | number | boolean | null | ArrayBuffer;

export interface QueryResult {
  rows: Array<Record<string, SqlValue>>;
  rowsAffected: number;
  insertId: number;
}

export interface NativeSqlite extends HybridObject<{ ios: "c++"; android: "c++" }> {
  open(name: string, location: string, readonly: boolean): number;
  execute(connectionId: number, sql: string, params: SqlValue[]): QueryResult;
  close(connectionId: number): void;
}

export interface NativeSqlitePlatform extends HybridObject<{ ios: "swift"; android: "kotlin" }> {
  getBaseDirectory(): string;
}
