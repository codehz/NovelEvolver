// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import {
  PROJECT_PAGE_INDEX,
  preloadProjectPages,
  projectPageAt,
  shouldReturnToExplorer,
} from "./project-pager-model";

describe("project pager model", () => {
  test("maps pages and indices", () => {
    expect(PROJECT_PAGE_INDEX).toEqual({ Explorer: 0, Editor: 1, AI: 2 });
    expect(projectPageAt(0)).toBe("Explorer");
    expect(projectPageAt(2)).toBe("AI");
    expect(projectPageAt(99)).toBe("Explorer");
  });

  test("preloads adjacent pages and retains visited pages", () => {
    const initial = preloadProjectPages("Explorer", new Set());
    expect([...initial]).toEqual(["Explorer", "Editor"]);

    const editor = preloadProjectPages("Editor", initial);
    expect([...editor]).toEqual(["Explorer", "Editor", "AI"]);
  });

  test("only intercepts non-wide back navigation away from Explorer", () => {
    expect(shouldReturnToExplorer("Editor", false)).toBe(true);
    expect(shouldReturnToExplorer("AI", false)).toBe(true);
    expect(shouldReturnToExplorer("Explorer", false)).toBe(false);
    expect(shouldReturnToExplorer("AI", true)).toBe(false);
  });
});
