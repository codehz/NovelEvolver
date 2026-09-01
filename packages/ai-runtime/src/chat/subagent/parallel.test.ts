import { describe, expect, test } from "bun:test";

import { runWithConcurrency } from "./parallel";

describe("runWithConcurrency", () => {
  test("preserves result order", async () => {
    const results = await runWithConcurrency(
      [0, 1, 2, 3, 4].map((value) => async () => value * 2),
      2,
    );
    expect(results).toEqual([0, 2, 4, 6, 8]);
  });

  test("respects concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;

    await runWithConcurrency(
      Array.from({ length: 6 }, () => async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return true;
      }),
      2,
    );

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  test("limit 1 runs sequentially", async () => {
    const order: number[] = [];
    await runWithConcurrency(
      [1, 2, 3].map((value) => async () => {
        order.push(value);
        return value;
      }),
      1,
    );
    expect(order).toEqual([1, 2, 3]);
  });
});
