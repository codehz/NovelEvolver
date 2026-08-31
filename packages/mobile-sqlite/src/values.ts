import type { SqlValue as NativeSqlValue } from "./NativeSqlite.nitro";

export type SqlValue = string | number | bigint | boolean | null | Uint8Array | ArrayBufferView;

export type QueryRow = Record<string, SqlValue>;

export type QueryResult = {
  rows: QueryRow[];
  rowsAffected: number;
  insertId: number;
};

function toUint8Array(value: Uint8Array | ArrayBufferView | ArrayBuffer): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

export function toNativeValue(value: SqlValue): NativeSqlValue {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  const bytes = toUint8Array(value);
  if (
    bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
  ) {
    return bytes.buffer;
  }
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export function fromNativeValue(value: NativeSqlValue): SqlValue {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  return value;
}

export function toNativeParams(params: SqlValue[]): NativeSqlValue[] {
  return params.map(toNativeValue);
}

export function fromNativeResult(result: {
  rows: Array<Record<string, NativeSqlValue>>;
  rowsAffected: number;
  insertId: number;
}): QueryResult {
  return {
    rows: result.rows.map((row) => {
      const decoded: QueryRow = {};
      for (const [key, value] of Object.entries(row)) {
        decoded[key] = fromNativeValue(value);
      }
      return decoded;
    }),
    rowsAffected: result.rowsAffected,
    insertId: result.insertId,
  };
}
