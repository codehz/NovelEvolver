// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import { asBytes, sha1Hex, toBase64 } from "./sha1";

describe("mobile SHA-1", () => {
  test("matches Git SHA-1 vectors", () => {
    expect(sha1Hex(asBytes(""))).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(sha1Hex(asBytes("abc"))).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(sha1Hex(asBytes("The quick brown fox jumps over the lazy dog"))).toBe(
      "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12",
    );
  });

  test("encodes bytes for the Android native module", () => {
    expect(toBase64(asBytes("abc"))).toBe("YWJj");
    expect(toBase64(new Uint8Array([0, 1, 2, 253, 254, 255]))).toBe("AAEC/f7/");
  });
});
