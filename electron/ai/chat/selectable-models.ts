import { MOCK_AI_MODEL_ID, type AiChatSelectableModel } from "#shared/rpc/ai/index";
import type { AiModelsSettingsSnapshot } from "#shared/rpc/services/index";

export type ResolveAiModelsSnapshot = () => AiModelsSettingsSnapshot;

export function listSelectableModels(options: {
  mockAiEnabled: boolean;
  models: AiModelsSettingsSnapshot;
}): AiChatSelectableModel[] {
  const items: AiChatSelectableModel[] = [];

  const providerById = new Map(options.models.providers.map((provider) => [provider.id, provider]));

  if (options.mockAiEnabled) {
    items.push({
      id: MOCK_AI_MODEL_ID,
      name: "Mock AI",
      kind: "mock",
      model: "mock-assistant",
      isDefault: options.models.defaultModelId === null && options.models.models.length === 0,
    });
  }

  for (const model of options.models.models) {
    const provider = providerById.get(model.providerId);
    if (!provider) {
      continue;
    }
    items.push({
      id: model.id,
      name: model.name,
      kind: provider.kind,
      model: model.model,
      isDefault: model.id === options.models.defaultModelId,
    });
  }

  return items;
}

export function isSelectableModelId(
  modelId: string,
  options: {
    mockAiEnabled: boolean;
    models: AiModelsSettingsSnapshot;
  },
): boolean {
  if (modelId === MOCK_AI_MODEL_ID) {
    return options.mockAiEnabled;
  }
  return options.models.models.some((model) => model.id === modelId);
}

/**
 * Resolve the default selected model for a new (or legacy) conversation.
 *
 * Priority: explicit preferred id (if still valid) → settings default → first
 * configured model → mock (when enabled) → empty.
 */
export function resolveDefaultSelectedModelId(options: {
  mockAiEnabled: boolean;
  models: AiModelsSettingsSnapshot;
  preferredId?: string | null;
}): string {
  const preferred = options.preferredId?.trim() ?? "";
  if (preferred !== "" && isSelectableModelId(preferred, options)) {
    return preferred;
  }

  const defaultId = options.models.defaultModelId;
  if (defaultId && isSelectableModelId(defaultId, options)) {
    return defaultId;
  }

  const first = options.models.models[0];
  if (first) {
    return first.id;
  }

  if (options.mockAiEnabled) {
    return MOCK_AI_MODEL_ID;
  }

  return "";
}
