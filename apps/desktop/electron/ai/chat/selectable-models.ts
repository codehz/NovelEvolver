import { MOCK_AI_MODEL_ID, type AiChatSelectableModel } from "#domain/ai";
import type { AiModelsSettingsSnapshot, AiReasoningLevel } from "#domain/settings/ai-settings";

export type ResolveAiModelsSnapshot = () => AiModelsSettingsSnapshot;

export type ReasoningLevelSource = {
  availableReasoningLevels: readonly AiReasoningLevel[];
  defaultReasoningLevel: AiReasoningLevel | null;
};

/**
 * Resolve the effective session reasoning level for a model.
 * - available empty → null
 * - preferred in available → preferred
 * - otherwise → defaultReasoningLevel (or first available)
 */
export function resolveReasoningLevelForModel(
  source: ReasoningLevelSource | null | undefined,
  preferred?: AiReasoningLevel | null,
): AiReasoningLevel | null {
  if (!source || source.availableReasoningLevels.length === 0) {
    return null;
  }
  if (preferred != null && source.availableReasoningLevels.includes(preferred)) {
    return preferred;
  }
  if (
    source.defaultReasoningLevel != null &&
    source.availableReasoningLevels.includes(source.defaultReasoningLevel)
  ) {
    return source.defaultReasoningLevel;
  }
  return source.availableReasoningLevels[0] ?? null;
}

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
      contextLength: null,
      availableReasoningLevels: [],
      defaultReasoningLevel: null,
    });
  }

  for (const model of options.models.models) {
    if (model.supportsTools === false) {
      continue;
    }
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
      contextLength: model.contextLength,
      availableReasoningLevels: [...model.availableReasoningLevels],
      defaultReasoningLevel: model.defaultReasoningLevel,
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
  return options.models.models.some(
    (model) => model.id === modelId && model.supportsTools !== false,
  );
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

  const first = options.models.models.find((model) => model.supportsTools !== false);
  if (first) {
    return first.id;
  }

  if (options.mockAiEnabled) {
    return MOCK_AI_MODEL_ID;
  }

  return "";
}
