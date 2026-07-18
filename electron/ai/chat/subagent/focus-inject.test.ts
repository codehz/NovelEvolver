import { describe, expect, test } from "bun:test";

import type {
  AiProjectStructureDomain,
  AiProjectStructureTarget,
  WorktreeSession,
} from "../../../worktree/session";
import {
  formatFocusSnapshotsForPrompt,
  resolveFocusSnapshots,
  type FocusSnapshot,
} from "./focus-inject";
import { MAX_FOCUS_CONTENT_CHARS, MAX_FOCUS_TARGETS } from "./policy";

type FakeNode = {
  domain: "manuscript" | "resource";
  kind: "chapter" | "file" | "folder";
  label: string;
  displayPath: string;
  content?: string;
  children?: Array<{
    id: string;
    kind: "chapter" | "file" | "folder";
    label: string;
    displayPath: string;
    charCount?: number;
  }>;
};

function createFakeWorktree(options?: {
  nodes?: Record<string, FakeNode>;
  revision?: number;
}): WorktreeSession {
  const nodes = options?.nodes ?? {};
  const revision = options?.revision ?? 7;

  return {
    getProjectNodeInfo(domain: AiProjectStructureDomain, id: string) {
      const node = nodes[`${domain}:${id}`];
      if (!node || node.domain !== domain) {
        throw new Error(`${domain} 节点不存在: ${id}`);
      }
      return {
        domain,
        id,
        kind: node.kind,
        label: node.label,
        displayPath: node.displayPath,
      };
    },
    readChapter(id: string) {
      const node = nodes[`manuscript:${id}`];
      if (!node || node.kind !== "chapter") {
        throw new Error(`Manuscript node is not a chapter: ${id}`);
      }
      return node.content ?? "";
    },
    readResourceFile(id: string) {
      const node = nodes[`resource:${id}`];
      if (!node || node.kind !== "file") {
        throw new Error(`Resource node is not a file: ${id}`);
      }
      return node.content ?? "";
    },
    getChangesSnapshot() {
      return { revision } as ReturnType<WorktreeSession["getChangesSnapshot"]>;
    },
    getProjectStructure(target?: AiProjectStructureTarget) {
      if (!target) {
        return { budget: 100, nodeCount: 0 };
      }
      const node = nodes[`${target.domain}:${target.id}`];
      if (!node) {
        throw new Error(`${target.domain} 节点不存在: ${target.id}`);
      }
      const children = (node.children ?? []).map((child) =>
        target.domain === "manuscript"
          ? {
              id: child.id,
              domain: "manuscript" as const,
              kind: child.kind as "folder" | "chapter",
              title: child.label,
              parentId: target.id,
              displayPath: child.displayPath,
              charCount: child.charCount,
            }
          : {
              id: child.id,
              domain: "resource" as const,
              kind: child.kind as "folder" | "file",
              name: child.label,
              parentId: target.id,
              displayPath: child.displayPath,
              charCount: child.charCount,
            },
      );
      if (target.domain === "manuscript") {
        return {
          budget: 100,
          nodeCount: children.length + 1,
          target,
          manuscript: {
            rootId: target.id,
            nodes: [
              {
                id: target.id,
                domain: "manuscript" as const,
                kind: "folder" as const,
                title: node.label,
                parentId: null,
                displayPath: node.displayPath,
              },
              ...children,
            ],
          },
        };
      }
      return {
        budget: 100,
        nodeCount: children.length + 1,
        target,
        resource: {
          rootId: target.id,
          nodes: [
            {
              id: target.id,
              domain: "resource" as const,
              kind: "folder" as const,
              name: node.label,
              parentId: null,
              displayPath: node.displayPath,
            },
            ...children,
          ],
        },
      };
    },
  } as unknown as WorktreeSession;
}

describe("resolveFocusSnapshots", () => {
  test("injects chapter content with revision", () => {
    const worktree = createFakeWorktree({
      nodes: {
        "manuscript:ch-1": {
          domain: "manuscript",
          kind: "chapter",
          label: "第一章",
          displayPath: "卷一/第一章",
          content: "主角抬起头。",
        },
      },
      revision: 11,
    });

    const snapshots = resolveFocusSnapshots(worktree, [{ domain: "manuscript", id: "ch-1" }]);

    expect(snapshots).toHaveLength(1);
    const snap = snapshots[0]!;
    expect(snap.status).toBe("ok");
    if (snap.status === "error" || snap.kind === "folder") {
      throw new Error("expected text snapshot");
    }
    expect(snap.content).toBe("主角抬起头。");
    expect(snap.revision).toBe(11);
    expect(snap.stats.char_count).toBe("主角抬起头。".length);
  });

  test("soft-fails missing nodes", () => {
    const worktree = createFakeWorktree();
    const snapshots = resolveFocusSnapshots(worktree, [{ domain: "resource", id: "missing" }]);
    expect(snapshots[0]?.status).toBe("error");
  });

  test("truncates long content", () => {
    const long = "字".repeat(MAX_FOCUS_CONTENT_CHARS + 20);
    const worktree = createFakeWorktree({
      nodes: {
        "resource:f-1": {
          domain: "resource",
          kind: "file",
          label: "设定",
          displayPath: "人设/设定",
          content: long,
        },
      },
    });
    const snapshots = resolveFocusSnapshots(worktree, [{ domain: "resource", id: "f-1" }]);
    const snap = snapshots[0]!;
    expect(snap.status).toBe("truncated");
    if (snap.status === "error" || snap.kind === "folder") {
      throw new Error("expected text snapshot");
    }
    expect(snap.content.includes("已截断")).toBe(true);
    expect(snap.originalCharCount).toBe(long.length);
  });

  test("resolves folder children summary", () => {
    const worktree = createFakeWorktree({
      nodes: {
        "resource:folder-1": {
          domain: "resource",
          kind: "folder",
          label: "人设",
          displayPath: "人设",
          children: [
            {
              id: "f-a",
              kind: "file",
              label: "主角",
              displayPath: "人设/主角",
              charCount: 12,
            },
          ],
        },
      },
    });
    const snapshots = resolveFocusSnapshots(worktree, [{ domain: "resource", id: "folder-1" }]);
    const snap = snapshots[0]!;
    expect(snap.kind).toBe("folder");
    if (snap.kind !== "folder") {
      throw new Error("expected folder");
    }
    expect(snap.children).toEqual([
      {
        id: "f-a",
        kind: "file",
        label: "主角",
        displayPath: "人设/主角",
        charCount: 12,
      },
    ]);
  });

  test("caps focus target count", () => {
    const nodes: Record<string, FakeNode> = {};
    for (let i = 0; i < MAX_FOCUS_TARGETS + 2; i += 1) {
      nodes[`manuscript:ch-${i}`] = {
        domain: "manuscript",
        kind: "chapter",
        label: `章${i}`,
        displayPath: `章${i}`,
        content: `c${i}`,
      };
    }
    const worktree = createFakeWorktree({ nodes });
    const focus = Array.from({ length: MAX_FOCUS_TARGETS + 2 }, (_, i) => ({
      domain: "manuscript" as const,
      id: `ch-${i}`,
    }));
    const snapshots = resolveFocusSnapshots(worktree, focus);
    expect(snapshots.length).toBe(MAX_FOCUS_TARGETS + 1);
    expect(snapshots.at(-1)?.status).toBe("error");
  });
});

describe("formatFocusSnapshotsForPrompt", () => {
  test("formats text and error snapshots", () => {
    const snapshots: FocusSnapshot[] = [
      {
        domain: "manuscript",
        id: "ch-1",
        kind: "chapter",
        label: "第一章",
        displayPath: "卷一/第一章",
        status: "ok",
        content: "内容",
        originalCharCount: 2,
        stats: { char_count: 2, line_count: 1, word_count: 1 },
        revision: 2,
      },
      {
        domain: "resource",
        id: "x",
        kind: null,
        label: null,
        displayPath: null,
        status: "error",
        error: "missing",
      },
    ];
    const text = formatFocusSnapshotsForPrompt(snapshots);
    expect(text).toContain("焦点预载");
    expect(text).toContain("内容");
    expect(text).toContain("预载失败");
    expect(text).toContain("missing");
  });
});
