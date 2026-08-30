import {
  ChatCompletionsAdapter,
  DeltaCompletionsAdapter,
  GeminiAdapter,
  MessagesAdapter,
  OllamaAdapter,
  ResponsesAdapter,
  createAIClient,
  type AIRequest,
} from "@codehz/ai";

import { isAiPromptCacheConfigured } from "#domain/settings/ai-settings";

import type { AiModelRuntimeConfig } from "../../settings/ai-models-store";
import { DEFAULT_AI_SYSTEM_PROMPT } from "../default-system-prompt";
import { AI_INSTRUCTIONS, AI_MODEL, createMockClient } from "../mock-adapter";
import { getMockScenario } from "../mock/scenario-registry";
import { MOCK_AI_INSTRUCTIONS, MOCK_AI_MODEL, createScenarioClient } from "../mock/scenario-runner";
import type { MockScenarioPacing } from "../mock/scenario-types";
import type { AiBackendSession } from "./ai-backend-session";

export function createAiBackendSession(options: {
  clientLabel: string;
  scenarioId?: string | null;
  pacing?: MockScenarioPacing;
  modelConfig?: AiModelRuntimeConfig | null;
  instructionsOverride?: string | null;
}): AiBackendSession {
  if (options.scenarioId) {
    const scenario = getMockScenario(options.scenarioId);
    return {
      adapterKind: "mock",
      model: MOCK_AI_MODEL,
      instructions: MOCK_AI_INSTRUCTIONS,
      client: createScenarioClient({
        scenario,
        pacing: options.pacing ?? "preview",
        clientLabel: options.clientLabel,
      }),
      scenarioId: scenario.id,
    };
  }

  if (options.modelConfig) {
    return createProviderBackendSession(options.modelConfig, options.instructionsOverride ?? null);
  }

  return {
    adapterKind: "mock",
    model: AI_MODEL,
    instructions: AI_INSTRUCTIONS,
    client: createMockClient(options.clientLabel),
    scenarioId: null,
  };
}

function requireApiKey(config: AiModelRuntimeConfig): string {
  if (config.apiKey) {
    return config.apiKey;
  }
  throw new Error(`模型“${config.name}”缺少 API Key，请先在设置中配置。`);
}

function hasEntries(record: Record<string, unknown>): boolean {
  return Object.keys(record).length > 0;
}

function createProviderBackendSession(
  config: AiModelRuntimeConfig,
  instructionsOverride: string | null,
): AiBackendSession {
  const baseUrl = config.baseUrl || undefined;
  const headers = hasEntries(config.headers) ? config.headers : undefined;
  const extraBody = hasEntries(config.extraBody) ? config.extraBody : undefined;
  const adapter = (() => {
    switch (config.kind) {
      case "responses":
        return new ResponsesAdapter({
          apiKey: requireApiKey(config),
          baseUrl,
          ...(headers ? { headers } : {}),
          ...(extraBody ? { extraBody } : {}),
        });
      case "chat-completions":
        return new ChatCompletionsAdapter({
          apiKey: requireApiKey(config),
          baseUrl,
          ...(headers ? { headers } : {}),
          ...(extraBody ? { extraBody } : {}),
        });
      case "delta-completions": {
        const deltaBaseUrl = config.baseUrl?.trim();
        if (!deltaBaseUrl) {
          throw new Error(
            `模型“${config.name}”的供应商缺少 Endpoint；delta-completions 必须配置 baseUrl。`,
          );
        }
        return new DeltaCompletionsAdapter({
          baseUrl: deltaBaseUrl,
          ...(config.apiKey ? { apiKey: config.apiKey } : {}),
          ...(headers ? { headers } : {}),
          ...(extraBody ? { extraBody } : {}),
        });
      }
      case "messages":
        return new MessagesAdapter({
          apiKey: requireApiKey(config),
          baseUrl,
          ...(headers ? { headers } : {}),
          ...(extraBody ? { extraBody } : {}),
        });
      case "ollama":
        return new OllamaAdapter({
          baseUrl,
          ...(config.apiKey ? { apiKey: config.apiKey } : {}),
          ...(headers ? { headers } : {}),
          ...(extraBody ? { extraBody } : {}),
        });
      case "gemini":
        return new GeminiAdapter({
          apiKey: requireApiKey(config),
          baseUrl,
          ...(headers ? { headers } : {}),
          ...(extraBody ? { extraBody } : {}),
        });
    }
  })();

  const defaults: Partial<AIRequest> = {
    ...(config.temperature != null ? { temperature: config.temperature } : {}),
    ...(isAiPromptCacheConfigured(config.cache) ? { cache: config.cache } : {}),
  };

  return {
    adapterKind: config.kind,
    model: config.model,
    instructions: instructionsOverride ?? DEFAULT_AI_SYSTEM_PROMPT,
    client: createAIClient({
      adapter,
      model: config.model,
      ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
    }),
    scenarioId: null,
    maxOutputTokens: config.maxOutputTokens,
    ...(config.defaultReasoningLevel != null
      ? { defaultReasoningLevel: config.defaultReasoningLevel }
      : {}),
  };
}
