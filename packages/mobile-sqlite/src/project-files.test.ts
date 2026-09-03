// @ts-expect-error Bun test types are intentionally not part of the package tsconfig.
import { describe, expect, test } from "bun:test";

import { displayNameFromFile, toProjectFileName } from "./project-file-name";

describe("toProjectFileName", () => {
  test("appends .npk and trims whitespace", () => {
    expect(toProjectFileName("  第一章  ")).toBe("第一章.npk");
  });

  test("strips an existing .npk suffix", () => {
    expect(toProjectFileName("demo.npk")).toBe("demo.npk");
    expect(toProjectFileName("demo.NPK")).toBe("demo.npk");
  });

  test("replaces path separators and reserved characters", () => {
    expect(toProjectFileName('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j.npk");
  });

  test("rejects empty and dot names", () => {
    expect(() => toProjectFileName("   ")).toThrow("项目名称不能为空");
    expect(() => toProjectFileName("...")).toThrow("项目名称不能为空");
    expect(() => toProjectFileName("..")).toThrow("项目名称不能为空");
  });
});

describe("displayNameFromFile", () => {
  test("strips the .npk suffix", () => {
    expect(displayNameFromFile("第一章.npk")).toBe("第一章");
  });
});
