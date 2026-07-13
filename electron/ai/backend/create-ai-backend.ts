import {
  ChatCompletionsAdapter,
  MessagesAdapter,
  OllamaAdapter,
  ResponsesAdapter,
  createAIClient,
} from "@codehz/ai";

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

function createProviderBackendSession(
  config: AiModelRuntimeConfig,
  instructionsOverride: string | null,
): AiBackendSession {
  const baseUrl = config.baseUrl || undefined;
  const adapter = (() => {
    switch (config.kind) {
      case "responses":
        return new ResponsesAdapter({ apiKey: requireApiKey(config), baseUrl });
      case "chat-completions":
        return new ChatCompletionsAdapter({ apiKey: requireApiKey(config), baseUrl });
      case "messages":
        return new MessagesAdapter({ apiKey: requireApiKey(config), baseUrl });
      case "ollama":
        return new OllamaAdapter({
          baseUrl,
          ...(config.apiKey ? { apiKey: config.apiKey } : {}),
        });
    }
  })();

  return {
    adapterKind: config.kind,
    model: config.model,
    instructions: instructionsOverride ?? DEFAULT_AI_SYSTEM_PROMPT,
    client: createAIClient({ adapter, model: config.model }),
    scenarioId: null,
    maxOutputTokens: config.maxOutputTokens,
  };
}
