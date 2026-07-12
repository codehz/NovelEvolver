import {
  isQuickPickDismissedError,
  quickPickApi,
  type QuickPickListItem,
} from "#app/shared/lib/quick-pick";
import type { AiChatSelectableModel } from "#shared/rpc/ai/index";

function kindLabel(kind: AiChatSelectableModel["kind"]): string {
  switch (kind) {
    case "mock":
      return "Mock";
    case "responses":
      return "Responses";
    case "chat-completions":
      return "Chat Completions";
    case "messages":
      return "Messages";
    case "ollama":
      return "Ollama";
  }
}

function toListItem(model: AiChatSelectableModel, activeModelId: string): QuickPickListItem {
  const traits = [kindLabel(model.kind), model.model];
  if (model.isDefault) {
    traits.push("默认");
  }
  return {
    id: model.id,
    label: model.name,
    detail: traits.join(" · "),
    emphasized: model.id === activeModelId,
  };
}

export async function pickAiChatModel(
  models: AiChatSelectableModel[],
  activeModelId: string,
): Promise<string | null> {
  try {
    const result = await quickPickApi.showList({
      title: "选择模型",
      searchLabel: "搜索模型",
      searchPlaceholder: "按名称或提供商筛选…",
      emptyMessage: "没有可用模型，请先在设置中添加",
      dismissAriaLabel: "关闭模型选择器",
      items: models.map((model) => toListItem(model, activeModelId)),
    });
    return result.kind === "item" ? result.id : null;
  } catch (error) {
    if (isQuickPickDismissedError(error)) {
      return null;
    }
    throw error;
  }
}
