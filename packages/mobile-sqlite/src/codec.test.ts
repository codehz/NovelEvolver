// @ts-expect-error Bun test types are intentionally not part of the package tsconfig.
import { describe, expect, test } from "bun:test";

import { decodeResult, encodeParams, fromBase64, toBase64 } from "./codec";

describe("mobile-sqlite codec", () => {
  test("encodes mixed bindings including empty blobs", () => {
    expect(encodeParams([null, true, 4n, "hi", new Uint8Array(), new Uint8Array([1, 2])])).toBe(
      JSON.stringify([
        null,
        true,
        4,
        "hi",
        { $blob: "" },
        { $blob: toBase64(new Uint8Array([1, 2])) },
      ]),
    );
  });

  test("round-trips empty and non-empty blobs in query results", () => {
    const empty = toBase64(new Uint8Array());
    const payload = toBase64(new Uint8Array([9, 8, 7]));
    const result = decodeResult(
      JSON.stringify({
        rows: [{ id: 1, empty: { $blob: empty }, data: { $blob: payload }, note: "ok" }],
        rowsAffected: 1,
        insertId: 2,
      }),
    );
    expect(result.rowsAffected).toBe(1);
    expect(result.insertId).toBe(2);
    expect(result.rows[0]?.note).toBe("ok");
    expect(result.rows[0]?.empty).toEqual(new Uint8Array());
    expect(result.rows[0]?.data).toEqual(new Uint8Array([9, 8, 7]));
  });

  test("rejects invalid base64", () => {
    expect(() => fromBase64("*")).toThrow("Invalid base64 blob");
  });
});
