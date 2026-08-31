// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import { deflateSync, inflateSync } from "./zlib";

describe("mobile zlib compatibility", () => {
  test("round-trips zlib-wrapped data", () => {
    const input = new TextEncoder().encode("Git packfile 数据");
    const compressed = deflateSync(input);
    const inflated = inflateSync(compressed);

    expect(inflated).toEqual(input);
  });

  test("reports only the compressed stream bytes", () => {
    const input = new TextEncoder().encode("pack object");
    const compressed = deflateSync(input);
    const withTrailingData = Buffer.concat([compressed, Buffer.from([0xaa, 0xbb])]);
    const inflated = inflateSync(withTrailingData, { info: true });

    expect(inflated).toMatchObject({
      buffer: input,
      engine: { bytesWritten: compressed.length },
    });
  });
});
