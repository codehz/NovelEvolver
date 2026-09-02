// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import { TextDecoder } from "./text-encoding";

describe("mobile text encoding compatibility", () => {
  test("round-trips UTF-8 text", () => {
    const value = "Git packfile 数据";
    const encoded = new TextEncoder().encode(value);
    expect(new TextDecoder().decode(encoded)).toBe(value);
  });

  test("rejects invalid UTF-8 when fatal is enabled", () => {
    const invalid = new Uint8Array([0xc0, 0x80]);
    expect(() => new TextDecoder("utf-8", { fatal: true }).decode(invalid)).toThrow(
      "Invalid UTF-8 sequence",
    );
  });

  test("strips a UTF-8 BOM when ignoreBOM is enabled", () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("abc")]);
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(withBom)).toBe("abc");
  });
});
