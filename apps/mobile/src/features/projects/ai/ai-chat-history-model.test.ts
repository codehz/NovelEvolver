// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import type { AiConversationSearchHit, AiConversationSummary } from "@novelevolver/domain/ai";

import {
  buildHistorySections,
  conversationBadges,
  conversationTitle,
  formatRelativeTime,
  resolveConversationTimeGroupId,
} from "./ai-chat-history-model";

const NOW = new Date(2026, 8, 3, 12, 0, 0).getTime();

function conversation(
  id: string,
  updatedAt: number,
  patch: Partial<AiConversationSummary> = {},
): AiConversationSummary {
  return {
    id,
    title: id,
    createdAt: updatedAt,
    updatedAt,
    activity: "idle",
    persisted: true,
    scenarioId: null,
    status: "active",
    ...patch,
  };
}

describe("AI chat history model", () => {
  test("normalizes empty titles and builds activity badges", () => {
    const item = conversation("one", NOW, {
      title: "   ",
      activity: "awaiting_user",
      status: "archived",
      scenarioId: "scenario",
    });

    expect(conversationTitle(item)).toBe("未命名会话");
    expect(conversationBadges(item)).toEqual(["等待回答", "已归档", "场景"]);
    expect(conversationBadges(conversation("draft", NOW, { persisted: false }))).toEqual([
      "未保存草稿",
    ]);
  });

  test("resolves local-day boundaries", () => {
    expect(resolveConversationTimeGroupId(new Date(2026, 8, 3, 0, 0, 0).getTime(), NOW)).toBe(
      "today",
    );
    expect(resolveConversationTimeGroupId(new Date(2026, 8, 2, 23, 59, 0).getTime(), NOW)).toBe(
      "yesterday",
    );
    expect(resolveConversationTimeGroupId(new Date(2026, 7, 29, 12, 0, 0).getTime(), NOW)).toBe(
      "last7days",
    );
    expect(resolveConversationTimeGroupId(new Date(2026, 7, 27, 12, 0, 0).getTime(), NOW)).toBe(
      "earlier",
    );
  });

  test("groups directory items in stable newest-group order", () => {
    const sections = buildHistorySections(
      [
        conversation("old", new Date(2026, 7, 1).getTime()),
        conversation("today", new Date(2026, 8, 3, 9).getTime()),
        conversation("week", new Date(2026, 7, 30).getTime()),
      ],
      false,
      NOW,
    );

    expect(sections.map((section) => section.id)).toEqual(["today", "last7days", "earlier"]);
    expect(sections.map((section) => section.data[0]?.conversation.id)).toEqual([
      "today",
      "week",
      "old",
    ]);
  });

  test("keeps search results ungrouped and projects snippets", () => {
    const hit: AiConversationSearchHit = {
      ...conversation("match", NOW),
      snippet: "命中的消息正文",
    };
    const sections = buildHistorySections([hit], true, NOW);

    expect(sections).toHaveLength(1);
    expect(sections[0]?.label).toBeNull();
    expect(sections[0]?.data[0]?.snippet).toBe("命中的消息正文");
  });

  test("formats recent activity consistently with desktop", () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe("刚刚");
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe("5 分钟前");
    expect(formatRelativeTime(NOW - 3 * 60 * 60_000, NOW)).toBe("3 小时前");
    expect(formatRelativeTime(NOW - 3 * 24 * 60 * 60_000, NOW)).toBe("3 天前");
  });
});
