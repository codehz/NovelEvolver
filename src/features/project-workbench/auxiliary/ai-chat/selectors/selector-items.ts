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
    case "delta-completions":
      return "Delta Completions";
    case "messages":
      return "Messages";
    case "ollama":
      return "Ollama";
    case "gemini":
      return "Gemini";
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

/**
 * First non-empty description line for selector rows, with light Markdown stripped.
 * Full multi-line text is reserved for settings / subagent catalog injection.
 */
export function agentDescriptionSelectorDetail(description: string): string {
  const firstLine =
    description
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "") ?? "";
  if (firstLine === "") {
    return "";
  }
  return firstLine
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/^#{1,6}\s+/, "")
    .trim();
}

export function toAgentSelectorItems(
  agents: readonly AiChatSelectableAgent[],
  models: readonly AiChatSelectableModel[],
  activeAgentId: string,
): AiChatSelectorItem[] {
  return agents.map((agent) => {
    const detailFromDescription = agentDescriptionSelectorDetail(agent.description);
    if (detailFromDescription !== "") {
      return {
        id: agent.id,
        label: agent.name,
        detail: detailFromDescription,
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
