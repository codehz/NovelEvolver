import {
  isQuickPickDismissedError,
  quickPickApi,
  type QuickPickListItem,
} from "#app/shared/lib/quick-pick";
import type { AiChatSelectableAgent, AiChatSelectableModel } from "#shared/rpc/ai/index";

function toListItem(
  agent: AiChatSelectableAgent,
  models: readonly AiChatSelectableModel[],
  activeAgentId: string,
): QuickPickListItem {
  const model = agent.defaultModelId
    ? (models.find((entry) => entry.id === agent.defaultModelId)?.name ?? "未知模型")
    : "继承默认模型";
  return {
    id: agent.id,
    label: agent.name,
    detail: `${agent.builtin ? "内置" : "自定义"} · ${model} · ${agent.toolCount} 个工具`,
    emphasized: agent.id === activeAgentId,
  };
}

export async function pickAiChatAgent(
  agents: AiChatSelectableAgent[],
  models: readonly AiChatSelectableModel[],
  activeAgentId: string,
): Promise<string | null> {
  try {
    const result = await quickPickApi.showList({
      title: "选择 Agent",
      searchLabel: "搜索 Agent",
      searchPlaceholder: "按名称筛选…",
      emptyMessage: "没有可用 Agent",
      dismissAriaLabel: "关闭 Agent 选择器",
      items: agents.map((agent) => toListItem(agent, models, activeAgentId)),
    });
    return result.kind === "item" ? result.id : null;
  } catch (error) {
    if (isQuickPickDismissedError(error)) {
      return null;
    }
    throw error;
  }
}
