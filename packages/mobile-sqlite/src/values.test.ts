// @ts-expect-error Bun test types are intentionally not part of the package tsconfig.
import { describe, expect, test } from "bun:test";

import { fromNativeResult, fromNativeValue, toNativeParams, toNativeValue } from "./values";

describe("mobile-sqlite values", () => {
  test("converts mixed bindings including empty blobs", () => {
    const empty = new Uint8Array();
    const payload = new Uint8Array([1, 2]);
    expect(toNativeParams([null, true, 4n, "hi", empty, payload])).toEqual([
      null,
      true,
      4,
      "hi",
      empty.buffer,
      payload.buffer,
    ]);
  });

  test("copies blob views that do not own the whole buffer", () => {
    const source = new Uint8Array([0, 9, 8, 7, 0]);
    const view = source.subarray(1, 4);
    const native = toNativeValue(view);
    expect(native).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(native as ArrayBuffer)).toEqual(new Uint8Array([9, 8, 7]));
  });

  test("wraps native blobs back into Uint8Array rows", () => {
    const empty = new ArrayBuffer(0);
    const payload = new Uint8Array([9, 8, 7]).buffer;
    const result = fromNativeResult({
      rows: [{ id: 1, empty, data: payload, note: "ok" }],
      rowsAffected: 1,
      insertId: 2,
    });
    expect(result.rowsAffected).toBe(1);
    expect(result.insertId).toBe(2);
    expect(result.rows[0]?.note).toBe("ok");
    expect(result.rows[0]?.empty).toEqual(new Uint8Array());
    expect(result.rows[0]?.data).toEqual(new Uint8Array([9, 8, 7]));
    expect(fromNativeValue(payload)).toEqual(new Uint8Array([9, 8, 7]));
  });
});
