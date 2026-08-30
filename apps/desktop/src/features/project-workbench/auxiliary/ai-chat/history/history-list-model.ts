import type { ContextMenuItem } from "#app/shared/lib/context-menu";
import type { AiConversationSearchHit, AiConversationSummary } from "#domain/ai";

import { groupConversationsByActivity } from "./group-conversations";

export type HistoryListItemEntry = {
  kind: "item";
  conversation: AiConversationSummary;
  snippet: string | null;
  optionIndex: number;
};

export type HistoryListEntry = { kind: "group"; id: string; label: string } | HistoryListItemEntry;

export function conversationTitle(conversation: AiConversationSummary): string {
  const title = conversation.title.trim();
  return title === "" ? "未命名会话" : title;
}

export function activityLabel(conversation: AiConversationSummary): string | null {
  switch (conversation.activity) {
    case "streaming":
      return "生成中";
    case "awaiting_user":
      return "等待回答";
    case "idle":
      return conversation.persisted ? null : "未保存草稿";
  }
}

export function conversationBadges(conversation: AiConversationSummary): string[] {
  const badges: string[] = [];
  const activity = activityLabel(conversation);
  if (activity) {
    badges.push(activity);
  }
  if (conversation.status === "archived") {
    badges.push("已归档");
  }
  if (conversation.scenarioId) {
    badges.push("场景");
  }
  return badges;
}

export function buildContextMenuItems(conversation: AiConversationSummary): ContextMenuItem[] {
  const items: ContextMenuItem[] = [{ id: "rename", label: "重命名" }];
  if (conversation.status === "archived") {
    items.push({ id: "unarchive", label: "取消归档" });
  } else {
    items.push({ id: "archive", label: "归档" });
  }
  items.push({ type: "separator" }, { id: "delete", label: "删除" });
  return items;
}

export function buildHistoryListEntries(
  items: readonly AiConversationSearchHit[],
  isSearching: boolean,
): HistoryListEntry[] {
  if (isSearching) {
    return items.map((conversation, optionIndex) => ({
      kind: "item" as const,
      conversation,
      snippet: conversation.snippet,
      optionIndex,
    }));
  }

  const groups = groupConversationsByActivity(items);
  const entries: HistoryListEntry[] = [];
  let optionIndex = 0;
  for (const group of groups) {
    entries.push({ kind: "group", id: group.id, label: group.label });
    for (const conversation of group.items) {
      entries.push({
        kind: "item",
        conversation,
        snippet: null,
        optionIndex,
      });
      optionIndex += 1;
    }
  }
  return entries;
}

export function historyEmptyMessage({
  loadingList,
  isSearching,
  includeArchived,
}: {
  loadingList: boolean;
  isSearching: boolean;
  includeArchived: boolean;
}): string {
  if (loadingList) {
    return "加载中…";
  }
  if (isSearching) {
    return "无匹配会话";
  }
  if (!includeArchived) {
    return "暂无历史会话";
  }
  return "暂无会话";
}

export function toSearchHits(
  conversations: readonly AiConversationSummary[],
): AiConversationSearchHit[] {
  return conversations.map((entry) => ({ ...entry, snippet: null }));
}
