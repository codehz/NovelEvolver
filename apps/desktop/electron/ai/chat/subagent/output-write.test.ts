import { describe, expect, test } from "bun:test";

import type { WorktreeSession } from "@novelevolver/worktree";

import {
  captureSubagentOutputTarget,
  parseOptionalOutputTarget,
  writeSubagentOutput,
} from "./output-write";

function createFakeWorktree(options: {
  domain: "manuscript" | "resource";
  id: string;
  label: string;
  displayPath: string;
  kind: "chapter" | "file";
  content: string;
  revision: number;
}): WorktreeSession {
  let content = options.content;
  let revision = options.revision;

  return {
    getTextDocumentInfo(domain: "manuscript" | "resource", id: string) {
      if (domain !== options.domain || id !== options.id) {
        throw new Error(`${domain} 节点不存在: ${id}`);
      }
      return {
        domain: options.domain,
        id: options.id,
        kind: options.kind,
        label: options.label,
        displayPath: options.displayPath,
      };
    },
    getDocumentContentRevision(domain: "manuscript" | "resource", id: string) {
      if (domain !== options.domain || id !== options.id) {
        throw new Error(`${domain} 节点不存在: ${id}`);
      }
      return revision;
    },
    readChapter(id: string) {
      if (options.domain !== "manuscript" || id !== options.id) {
        throw new Error(`Manuscript node is not a chapter: ${id}`);
      }
      return content;
    },
    readResourceFile(id: string) {
      if (options.domain !== "resource" || id !== options.id) {
        throw new Error(`Resource node is not a file: ${id}`);
      }
      return content;
    },
    writeChapter(id: string, next: string) {
      if (options.domain !== "manuscript" || id !== options.id) {
        throw new Error(`Manuscript node is not a chapter: ${id}`);
      }
      content = next;
      revision += 1;
    },
    writeResourceFile(id: string, next: string) {
      if (options.domain !== "resource" || id !== options.id) {
        throw new Error(`Resource node is not a file: ${id}`);
      }
      content = next;
      revision += 1;
    },
  } as unknown as WorktreeSession;
}

describe("parseOptionalOutputTarget", () => {
  test("returns null when omitted", () => {
    expect(parseOptionalOutputTarget(undefined)).toBeNull();
  });

  test("parses domain and id", () => {
    expect(parseOptionalOutputTarget({ domain: "manuscript", id: "ch-1" })).toEqual({
      domain: "manuscript",
      id: "ch-1",
    });
  });
});

describe("writeSubagentOutput", () => {
  test("writes content and returns stats", () => {
    const worktree = createFakeWorktree({
      domain: "manuscript",
      id: "ch-1",
      label: "第一章",
      displayPath: "卷一/第一章",
      kind: "chapter",
      content: "旧正文",
      revision: 2,
    });
    const captured = captureSubagentOutputTarget(worktree, { domain: "manuscript", id: "ch-1" });
    const result = writeSubagentOutput(worktree, captured, "新章节正文");

    expect(result.written).toBe(true);
    expect(result.error).toBeNull();
    expect(result.target?.id).toBe("ch-1");
    expect(result.stats?.char_count).toBe(5);
    expect(result.revision).toBe(3);
    expect(worktree.readChapter("ch-1")).toBe("新章节正文");
  });

  test("fails when revision changed during run", () => {
    const worktree = createFakeWorktree({
      domain: "resource",
      id: "f-1",
      label: "设定",
      displayPath: "设定/人物",
      kind: "file",
      content: "",
      revision: 0,
    });
    const captured = captureSubagentOutputTarget(worktree, { domain: "resource", id: "f-1" });
    worktree.writeResourceFile("f-1", "并发修改");
    const result = writeSubagentOutput(worktree, captured, "子代理正文");

    expect(result.written).toBe(false);
    expect(result.error).toContain("revision 不匹配");
  });
});
