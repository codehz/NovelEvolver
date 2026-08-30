import type { AiConversationSummary } from "#shared/rpc/ai/index";

export type ConversationTimeGroupId = "today" | "yesterday" | "last7days" | "earlier";

export type ConversationTimeGroup = {
  id: ConversationTimeGroupId;
  label: string;
  items: AiConversationSummary[];
};

const GROUP_ORDER: ConversationTimeGroupId[] = ["today", "yesterday", "last7days", "earlier"];

const GROUP_LABELS: Record<ConversationTimeGroupId, string> = {
  today: "今天",
  yesterday: "昨天",
  last7days: "近 7 天",
  earlier: "更早",
};

function startOfLocalDay(timestampMs: number): number {
  const date = new Date(timestampMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function resolveConversationTimeGroupId(
  updatedAt: number,
  nowMs = Date.now(),
): ConversationTimeGroupId {
  const todayStart = startOfLocalDay(nowMs);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const last7Start = todayStart - 6 * 24 * 60 * 60 * 1000;

  if (updatedAt >= todayStart) {
    return "today";
  }
  if (updatedAt >= yesterdayStart) {
    return "yesterday";
  }
  if (updatedAt >= last7Start) {
    return "last7days";
  }
  return "earlier";
}

export function groupConversationsByActivity(
  conversations: readonly AiConversationSummary[],
  nowMs = Date.now(),
): ConversationTimeGroup[] {
  const buckets = new Map<ConversationTimeGroupId, AiConversationSummary[]>();
  for (const id of GROUP_ORDER) {
    buckets.set(id, []);
  }

  for (const conversation of conversations) {
    const groupId = resolveConversationTimeGroupId(conversation.updatedAt, nowMs);
    buckets.get(groupId)!.push(conversation);
  }

  return GROUP_ORDER.flatMap((id) => {
    const items = buckets.get(id) ?? [];
    if (items.length === 0) {
      return [];
    }
    return [
      {
        id,
        label: GROUP_LABELS[id],
        items,
      },
    ];
  });
}
