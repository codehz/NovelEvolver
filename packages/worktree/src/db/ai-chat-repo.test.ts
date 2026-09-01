import { Database as BunDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import {
  AiChatRepository,
  initAppState,
  ProjectsRepository,
  type AiConversationRecord,
  type DatabasePort,
  type SqlValue,
} from "@novelevolver/worktree";

function asBunPort(db: BunDatabase): DatabasePort {
  return {
    exec(sql: string): void {
      db.exec(sql.trim().replace(/;\s*$/, ""));
    },
    prepare(sql: string) {
      const statement = db.prepare(sql);
      return {
        run(...params: SqlValue[]) {
          const result = statement.run(...params);
          return { changes: Number(result.changes) };
        },
        get(...params: SqlValue[]) {
          return statement.get(...params) ?? null;
        },
        all(...params: SqlValue[]) {
          return statement.all(...params);
        },
      };
    },
  };
}

function sampleRecord(
  projectId: number,
  overrides: Partial<AiConversationRecord> = {},
): AiConversationRecord {
  const now = 1_700_000_000_000;
  return {
    id: "conv-1",
    projectId,
    title: "第一章草稿",
    titleCustomized: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
    adapterKind: "mock",
    model: "mock",
    selectedModelId: "",
    selectedAgentId: "builtin-writing-assistant",
    selectedReasoningLevel: null,
    scenarioId: null,
    messagesJson: "[]",
    historyJson: "[]",
    pendingToolBatchJson: null,
    warningsJson: "[]",
    errorMessage: null,
    continueAssistantId: null,
    ...overrides,
  };
}

describe("AiChatRepository", () => {
  test("upsert, list, search, and cascade-delete with the project", () => {
    const appDb = new BunDatabase(":memory:");
    appDb.exec("PRAGMA foreign_keys = ON");
    const port = asBunPort(appDb);
    initAppState(port);

    const projects = new ProjectsRepository(port);
    const aiChat = new AiChatRepository(port);
    const project = projects.upsertByPath("/tmp/novel.npk", Date.now());

    aiChat.upsert(
      sampleRecord(project.id, {
        messagesJson: JSON.stringify([{ role: "user", text: "写一段开场" }]),
      }),
    );

    expect(aiChat.getById(project.id, "conv-1")?.title).toBe("第一章草稿");
    expect(aiChat.listSummariesByProject(project.id)).toEqual([
      expect.objectContaining({ id: "conv-1", title: "第一章草稿", hasPendingToolBatch: false }),
    ]);
    expect(aiChat.searchByProject(project.id, "开场")).toEqual([
      expect.objectContaining({ id: "conv-1" }),
    ]);

    expect(aiChat.updateTitle(project.id, "conv-1", "自定义标题", true)).toBe(true);
    expect(aiChat.getById(project.id, "conv-1")?.titleCustomized).toBe(true);
    expect(aiChat.setStatus(project.id, "conv-1", "archived")).toBe(true);
    expect(aiChat.listSummariesByProject(project.id)).toEqual([]);
    expect(aiChat.listSummariesByProject(project.id, { status: "archived" })).toHaveLength(1);

    expect(projects.removeById(project.id)).toBe(true);
    expect(aiChat.getById(project.id, "conv-1")).toBeNull();
  });
});
