import type { AiChatSelectableAgent, AiChatSelectableModel } from "#shared/rpc/ai/index";

export type AiChatSelectorItem = {
  id: string;
  label: string;
  detail?: string;
  emphasized?: boolean;
};

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

export function toModelSelectorItems(
  models: readonly AiChatSelectableModel[],
  activeModelId: string,
): AiChatSelectorItem[] {
  return models.map((model) => {
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
  });
}

export function toAgentSelectorItems(
  agents: readonly AiChatSelectableAgent[],
  models: readonly AiChatSelectableModel[],
  activeAgentId: string,
): AiChatSelectorItem[] {
  return agents.map((agent) => {
    const description = agent.description.trim();
    if (description !== "") {
      return {
        id: agent.id,
        label: agent.name,
        detail: description,
        emphasized: agent.id === activeAgentId,
      };
    }
    const model = agent.defaultModelId
      ? (models.find((entry) => entry.id === agent.defaultModelId)?.name ?? "未知模型")
      : "继承默认模型";
    return {
      id: agent.id,
      label: agent.name,
      detail: `${agent.builtin ? "内置" : "自定义"} · ${model} · ${agent.toolCount} 个工具`,
      emphasized: agent.id === activeAgentId,
    };
  });
}
