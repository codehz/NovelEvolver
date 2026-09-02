// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import {
  buildComposerSendPayload,
  filterMentionCatalog,
  filterPromptItems,
  isComposerEmpty,
  isValidMentionQuery,
  isValidSlashQuery,
} from "./composer-query";
import type { MentionCatalogItem } from "./mention-catalog";

describe("composer query helpers", () => {
  test("accepts document-start slash queries only", () => {
    expect(isValidSlashQuery("/expand"));
    expect(isValidSlashQuery("/"));
    expect(isValidSlashQuery("hello /expand")).toBe(false);
    expect(isValidSlashQuery("/中文")).toBe(false);
  });

  test("accepts boundary-aware CJK mention queries", () => {
    expect(isValidMentionQuery("@章节一"));
    expect(isValidMentionQuery("请修改 @章节一"));
    expect(isValidMentionQuery("email@example.com")).toBe(false);
  });

  test("filters prompt and mention catalogs", () => {
    const prompt = { id: "p1", slug: "expand", title: "扩写", prompt: "body" } as const;
    const item: MentionCatalogItem = {
      domain: "manuscript",
      id: "c1",
      kind: "chapter",
      label: "第一章",
      displayPath: "正文/第一章",
    };
    expect(filterPromptItems([prompt], "扩")).toEqual([prompt]);
    expect(filterMentionCatalog([item], "正文")).toEqual([item]);
  });

  test("removes the confirmed prompt marker from the send text", () => {
    const slash = { promptId: "p1", slug: "expand", title: "扩写", body: "body" };
    expect(buildComposerSendPayload("/expand 请继续", slash, []).text).toBe(" 请继续");
    expect(isComposerEmpty("/expand", slash, [])).toBe(false);
  });
});
