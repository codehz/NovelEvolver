// @ts-expect-error Bun test types are intentionally not part of this package tsconfig.
import { describe, expect, test } from "bun:test";

import { createByteStream } from "./byte-stream";
import { StreamHeaders } from "./headers";
import { StreamResponse } from "./response";

describe("mobile stream fetch helpers", () => {
  test("joins duplicate response headers", () => {
    const headers = new StreamHeaders([
      { key: "Content-Type", value: "text/plain" },
      { key: "Set-Cookie", value: "a=1" },
      { key: "set-cookie", value: "b=2" },
    ]);
    expect(headers.get("content-type")).toBe("text/plain");
    expect(headers.get("set-cookie")).toBe("a=1, b=2");
  });

  test("exposes a readable body and drains it for text()", async () => {
    const body = createByteStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("hel"));
        controller.enqueue(new TextEncoder().encode("lo"));
        controller.close();
      },
    });
    const response = new StreamResponse({
      url: "https://example.test/stream",
      status: 200,
      statusText: "OK",
      headers: [{ key: "content-type", value: "text/plain" }],
      body,
    });
    expect(response.ok).toBe(true);
    expect(response.body).not.toBeNull();
    expect(await response.text()).toBe("hello");
  });

  test("lets a reader consume chunks incrementally", async () => {
    const body = createByteStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    });
    const reader = body.getReader();
    expect(await reader.read()).toEqual({ done: false, value: new Uint8Array([1, 2]) });
    expect(await reader.read()).toEqual({ done: false, value: new Uint8Array([3]) });
    expect(await reader.read()).toEqual({ done: true, value: undefined });
  });
});
