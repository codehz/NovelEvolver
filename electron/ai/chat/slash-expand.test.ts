import { describe, expect, test } from "bun:test";

import { expandSlashForModel, formatUserMessageDisplay } from "./slash-expand";

const slash = {
  promptId: "p1",
  slug: "expand",
  title: "扩写",
  body: "请扩写以下内容：",
};

describe("expandSlashForModel", () => {
  test("plain text trims", () => {
    expect(expandSlashForModel(null, "  hello  ")).toBe("hello");
  });

  test("slash only uses body", () => {
    expect(expandSlashForModel(slash, "   ")).toBe("请扩写以下内容：");
  });

  test("slash + remainder joins with blank line", () => {
    expect(expandSlashForModel(slash, "第三章")).toBe("请扩写以下内容：\n\n第三章");
  });
});

describe("formatUserMessageDisplay", () => {
  test("plain text passthrough", () => {
    expect(formatUserMessageDisplay(null, "hi")).toBe("hi");
  });

  test("slash only", () => {
    expect(formatUserMessageDisplay(slash, "")).toBe("/expand");
  });

  test("slash + remainder with leading space preserved", () => {
    expect(formatUserMessageDisplay(slash, " 第三章")).toBe("/expand 第三章");
  });

  test("slash + remainder without leading space gets one", () => {
    expect(formatUserMessageDisplay(slash, "第三章")).toBe("/expand 第三章");
  });
});
