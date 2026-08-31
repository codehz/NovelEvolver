// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import {
  parseProjectCatalog,
  sortProjectCatalog,
  type MobileProjectRecord,
} from "./project-catalog-model";

function record(id: string, lastOpenedAt: number): MobileProjectRecord {
  return {
    id,
    displayName: id,
    sourceUri: null,
    repositoryFileName: "repository.npk",
    worktreeFileName: "worktree.sqlite",
    lastOpenedAt,
  };
}

describe("project catalog model", () => {
  test("filters malformed persisted entries", () => {
    expect(parseProjectCatalog([record("valid", 1), { id: "invalid" }, null])).toEqual([
      record("valid", 1),
    ]);
    expect(parseProjectCatalog(null)).toEqual([]);
  });

  test("sorts most recently opened projects first without mutating input", () => {
    const input = [record("old", 1), record("new", 2)];
    expect(sortProjectCatalog(input).map((item) => item.id)).toEqual(["new", "old"]);
    expect(input.map((item) => item.id)).toEqual(["old", "new"]);
  });
});
