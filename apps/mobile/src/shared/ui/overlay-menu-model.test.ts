// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import { isMenuGroupStart } from "./overlay-menu-model";

describe("isMenuGroupStart", () => {
  test("starts a group for the first grouped option", () => {
    expect(isMenuGroupStart("OpenAI", undefined)).toBe(true);
  });

  test("does not repeat the current group label", () => {
    expect(isMenuGroupStart("OpenAI", "OpenAI")).toBe(false);
  });

  test("starts a new group after an ungrouped option", () => {
    expect(isMenuGroupStart("Anthropic", undefined)).toBe(true);
  });

  test("does not render a label for ungrouped options", () => {
    expect(isMenuGroupStart(undefined, "OpenAI")).toBe(false);
  });
});
