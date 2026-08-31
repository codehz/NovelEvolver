// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import type { Database } from "@novelevolver/mobile-sqlite";

import { adaptMobileSqlite } from "./nano-git-sqlite-adapter";

describe("adaptMobileSqlite", () => {
  test("converts nano-git bindings and delegates statement methods", () => {
    const calls: Array<{ method: string; values: unknown[] }> = [];
    const statement = {
      get: (...values: unknown[]) => {
        calls.push({ method: "get", values });
        return null;
      },
      all: (...values: unknown[]) => {
        calls.push({ method: "all", values });
        return [];
      },
      run: (...values: unknown[]) => {
        calls.push({ method: "statement.run", values });
        return undefined;
      },
    };
    const mobileDb = {
      run: (sql: string, ...values: unknown[]) => {
        calls.push({ method: sql, values });
        return undefined;
      },
      query: () => statement,
      transaction:
        (fn: (...args: unknown[]) => unknown) =>
        (...args: unknown[]) =>
          fn(...args),
    } as unknown as Database;
    const sqlite = adaptMobileSqlite(mobileDb);
    const binary = new Uint8Array([1, 2]);

    sqlite.run("INSERT", [false, 4n, binary]);
    sqlite.query("SELECT").get(true, 2n, binary);
    sqlite.query("SELECT").all(false);
    sqlite.query("DELETE").run(true);

    expect(calls).toEqual([
      { method: "INSERT", values: [0, 4, binary] },
      { method: "get", values: [1, 2, binary] },
      { method: "all", values: [0] },
      { method: "statement.run", values: [1] },
    ]);
  });

  test("keeps transaction arguments and return values", () => {
    const mobileDb = {
      run: () => undefined,
      query: () => ({ get: () => null, all: () => [], run: () => undefined }),
      transaction:
        (fn: (...args: unknown[]) => string) =>
        (...args: unknown[]) =>
          fn(...args),
    } as unknown as Database;
    const sqlite = adaptMobileSqlite(mobileDb);

    expect(
      sqlite.transaction((prefix: string, suffix: string) => `${prefix}-${suffix}`)("a", "b"),
    ).toBe("a-b");
  });
});
