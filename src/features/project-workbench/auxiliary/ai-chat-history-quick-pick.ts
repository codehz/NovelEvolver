import {
  isQuickPickDismissedError,
  quickPickApi,
  type QuickPickListItem,
} from "#app/shared/lib/quick-pick";
import type { AiConversationSummary } from "#shared/rpc/ai-rpc";

function formatConversationActivity(conversation: AiConversationSummary): string | null {
  switch (conversation.activity) {
    case "streaming":
      return "生成中";
    case "awaiting_user":
      return "等待回答";
    case "idle":
      return conversation.persisted ? null : "未保存草稿";
  }
}

function formatConversationDetail(conversation: AiConversationSummary): string {
  const parts: string[] = [];
  const activity = formatConversationActivity(conversation);
  if (activity) {
    parts.push(activity);
  }

  try {
    parts.push(new Date(conversation.lastActiveAt).toLocaleString());
  } catch {
    // Ignore invalid dates; activity text alone is still useful.
  }

  return parts.join(" · ");
}

function toListItem(
  conversation: AiConversationSummary,
  activeConversationId: string,
): QuickPickListItem {
  return {
    id: conversation.id,
    label: conversation.title || "未命名会话",
    detail: formatConversationDetail(conversation),
    emphasized: conversation.id === activeConversationId,
  };
}

export async function pickAiConversation(options: {
  conversations: AiConversationSummary[];
  activeConversationId: string;
}): Promise<string | null> {
  try {
    const listResult = await quickPickApi.showList({
      title: "历史会话",
      searchLabel: "搜索会话",
      searchPlaceholder: "按标题筛选…",
      emptyMessage: "暂无历史会话",
      dismissAriaLabel: "关闭历史会话选择器",
      items: options.conversations.map((conversation) =>
        toListItem(conversation, options.activeConversationId),
      ),
    });

    if (listResult.kind === "item") {
      return listResult.id;
    }
    return null;
  } catch (error) {
    if (isQuickPickDismissedError(error)) {
      return null;
    }
    throw error;
  }
}
