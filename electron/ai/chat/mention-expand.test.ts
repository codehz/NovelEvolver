import { describe, expect, test } from "bun:test";

import type { AiChatMentionRef } from "#shared/rpc/ai/index";

import { expandMentionsForModel, formatMentionForModel } from "./mention-expand";
import { expandSlashForModel } from "./slash-expand";

const chapter: AiChatMentionRef = {
  domain: "manuscript",
  id: "ch-3",
  kind: "chapter",
  label: "第三章",
  displayPath: "卷一/第三章",
  token: "@卷一/第三章",
};

const folder: AiChatMentionRef = {
  domain: "manuscript",
  id: "vol-1",
  kind: "folder",
  label: "卷一",
  displayPath: "卷一",
  token: "@卷一",
};

const resource: AiChatMentionRef = {
  domain: "resource",
  id: "res-1",
  kind: "file",
  label: "设定.md",
  displayPath: "设定.md",
  token: "@设定.md",
};

describe("formatMentionForModel", () => {
  test("formats chapter ref", () => {
    expect(formatMentionForModel(chapter)).toBe(
      '@第三章 [manuscript chapter id=ch-3 path="卷一/第三章"]',
    );
  });

  test("formats folder ref", () => {
    expect(formatMentionForModel(folder)).toBe('@卷一 [manuscript folder id=vol-1 path="卷一"]');
  });
});

describe("expandMentionsForModel", () => {
  test("empty mentions passthrough", () => {
    expect(expandMentionsForModel("hello @x", [])).toBe("hello @x");
    expect(expandMentionsForModel("hello", null)).toBe("hello");
  });

  test("single token", () => {
    expect(expandMentionsForModel(`请改 ${chapter.token}`, [chapter])).toBe(
      '请改 @第三章 [manuscript chapter id=ch-3 path="卷一/第三章"]',
    );
  });

  test("multiple tokens keep surrounding text", () => {
    const text = `对照 ${chapter.token} 与 ${resource.token}`;
    expect(expandMentionsForModel(text, [chapter, resource])).toBe(
      '对照 @第三章 [manuscript chapter id=ch-3 path="卷一/第三章"] 与 @设定.md [resource file id=res-1 path="设定.md"]',
    );
  });

  test("longest token wins over prefix", () => {
    // `@卷一/第三章` must not be partially replaced by `@卷一`.
    const text = `看 ${chapter.token}`;
    expect(expandMentionsForModel(text, [folder, chapter])).toBe(
      '看 @第三章 [manuscript chapter id=ch-3 path="卷一/第三章"]',
    );
  });

  test("composes with slash expand", () => {
    const slash = {
      promptId: "p1",
      slug: "expand",
      title: "扩写",
      body: "请扩写以下内容：",
    };
    const remainder = `基于 ${chapter.token}`;
    const modelText = expandMentionsForModel(expandSlashForModel(slash, remainder), [chapter]);
    expect(modelText).toBe(
      '请扩写以下内容：\n\n基于 @第三章 [manuscript chapter id=ch-3 path="卷一/第三章"]',
    );
  });
});
