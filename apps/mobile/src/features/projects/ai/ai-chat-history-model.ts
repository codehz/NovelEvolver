import type { AiConversationSearchHit, AiConversationSummary } from "@novelevolver/domain/ai";

export type ConversationTimeGroupId = "today" | "yesterday" | "last7days" | "earlier";

export type AiChatHistoryItem = {
  conversation: AiConversationSummary;
  snippet: string | null;
};

export type AiChatHistorySection = {
  id: ConversationTimeGroupId | "search";
  label: string | null;
  data: AiChatHistoryItem[];
};

const GROUP_ORDER: ConversationTimeGroupId[] = ["today", "yesterday", "last7days", "earlier"];

const GROUP_LABELS: Record<ConversationTimeGroupId, string> = {
  today: "今天",
  yesterday: "昨天",
  last7days: "近 7 天",
  earlier: "更早",
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function startOfLocalDay(timestampMs: number): number {
  const date = new Date(timestampMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatCompactDateTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

export function conversationTitle(conversation: AiConversationSummary): string {
  const title = conversation.title.trim();
  return title === "" ? "未命名会话" : title;
}

export function conversationBadges(conversation: AiConversationSummary): string[] {
  const badges: string[] = [];
  if (conversation.activity === "streaming") badges.push("生成中");
  if (conversation.activity === "awaiting_user") badges.push("等待回答");
  if (conversation.activity === "idle" && !conversation.persisted) badges.push("未保存草稿");
  if (conversation.status === "archived") badges.push("已归档");
  if (conversation.scenarioId) badges.push("场景");
  return badges;
}

export function resolveConversationTimeGroupId(
  updatedAt: number,
  nowMs = Date.now(),
): ConversationTimeGroupId {
  const todayStart = startOfLocalDay(nowMs);
  const yesterdayStart = todayStart - DAY_MS;
  const last7Start = todayStart - 6 * DAY_MS;

  if (updatedAt >= todayStart) return "today";
  if (updatedAt >= yesterdayStart) return "yesterday";
  if (updatedAt >= last7Start) return "last7days";
  return "earlier";
}

export function formatRelativeTime(timestampMs: number, nowMs = Date.now()): string {
  const delta = Math.max(0, nowMs - timestampMs);
  if (delta < MINUTE_MS) return "刚刚";
  if (delta < HOUR_MS) return `${Math.floor(delta / MINUTE_MS)} 分钟前`;
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)} 小时前`;
  if (delta < 2 * DAY_MS) return "昨天";
  if (delta < 7 * DAY_MS) return `${Math.floor(delta / DAY_MS)} 天前`;
  return formatCompactDateTime(timestampMs);
}

export function buildHistorySections(
  conversations: readonly (AiConversationSummary | AiConversationSearchHit)[],
  isSearching: boolean,
  nowMs = Date.now(),
): AiChatHistorySection[] {
  if (isSearching) {
    return [
      {
        id: "search",
        label: null,
        data: conversations.map((conversation) => ({
          conversation,
          snippet: "snippet" in conversation ? conversation.snippet : null,
        })),
      },
    ];
  }

  const buckets = new Map<ConversationTimeGroupId, AiChatHistoryItem[]>();
  for (const id of GROUP_ORDER) buckets.set(id, []);
  for (const conversation of conversations) {
    buckets.get(resolveConversationTimeGroupId(conversation.updatedAt, nowMs))!.push({
      conversation,
      snippet: null,
    });
  }

  return GROUP_ORDER.flatMap((id) => {
    const data = buckets.get(id) ?? [];
    return data.length === 0 ? [] : [{ id, label: GROUP_LABELS[id], data }];
  });
}
