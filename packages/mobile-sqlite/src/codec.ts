const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export type SqlValue = string | number | bigint | boolean | null | Uint8Array | ArrayBufferView;

export type QueryRow = Record<string, SqlValue>;

export type QueryResult = {
  rows: QueryRow[];
  rowsAffected: number;
  insertId: number;
};

type BlobHolder = { $blob: string };

function isBlobHolder(value: unknown): value is BlobHolder {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.keys(value).length === 1 &&
    typeof (value as BlobHolder).$blob === "string"
  );
}

function toUint8Array(value: Uint8Array | ArrayBufferView | ArrayBuffer): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

export function toBase64(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    result += BASE64_ALPHABET[first >> 2];
    result += BASE64_ALPHABET[((first & 3) << 4) | ((second ?? 0) >> 4)];
    result +=
      second === undefined ? "=" : BASE64_ALPHABET[((second & 15) << 2) | ((third ?? 0) >> 6)];
    result += third === undefined ? "=" : BASE64_ALPHABET[third & 63];
  }
  return result;
}

export function fromBase64(value: string): Uint8Array {
  const compact = value.replaceAll(/[\s=]/g, "");
  const output = new Uint8Array((compact.length * 3) >> 2);
  let buffer = 0;
  let bits = 0;
  let written = 0;
  for (const char of compact) {
    const index = BASE64_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new TypeError("Invalid base64 blob");
    }
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[written] = (buffer >> bits) & 0xff;
      written += 1;
    }
  }
  return output.subarray(0, written);
}

function encodeValue(value: SqlValue): unknown {
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
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return { $blob: toBase64(toUint8Array(value)) };
  }
  throw new TypeError("Unsupported SQLite binding");
}

function decodeValue(value: unknown): SqlValue {
  if (isBlobHolder(value)) {
    return fromBase64(value.$blob);
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  throw new TypeError("Unsupported SQLite result value");
}

export function encodeParams(params: SqlValue[]): string {
  return JSON.stringify(params.map(encodeValue));
}

export function decodeResult(json: string): QueryResult {
  const parsed = JSON.parse(json) as {
    rows?: Array<Record<string, unknown>>;
    rowsAffected?: number;
    insertId?: number;
  };
  const rows = (parsed.rows ?? []).map((row) => {
    const decoded: QueryRow = {};
    for (const [key, value] of Object.entries(row)) {
      decoded[key] = decodeValue(value);
    }
    return decoded;
  });
  return {
    rows,
    rowsAffected: parsed.rowsAffected ?? 0,
    insertId: parsed.insertId ?? 0,
  };
}
