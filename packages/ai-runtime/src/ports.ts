import type {
  AiAgentsSettingsSnapshot,
  AiModelsSettingsSnapshot,
  AiRuntimePolicySnapshot,
} from "@novelevolver/domain/settings/ai-settings";
import type { AiAgentRuntimeConfig } from "@novelevolver/domain/settings/stores/ai-agents-state";
import type { AiModelRuntimeConfig as DomainAiModelRuntimeConfig } from "@novelevolver/domain/settings/stores/ai-models-state";

/** Runtime model config after API-key resolution. Extra provider metadata is optional. */
export type AiModelRuntimeConfig = Omit<
  DomainAiModelRuntimeConfig,
  "providerHasApiKey" | "providerName"
>;

export type { AiAgentRuntimeConfig };

export type AiModelsPort = {
  getSnapshot(): AiModelsSettingsSnapshot;
  getRuntimeConfig(id: string): AiModelRuntimeConfig | null;
};

export type AiAgentsPort = {
  getSnapshot(): AiAgentsSettingsSnapshot;
  getRuntimeConfig(id: string): AiAgentRuntimeConfig;
  findRuntimeConfig(id: string): AiAgentRuntimeConfig | null;
};

export type AiRuntimePolicyPort = {
  getSnapshot(): AiRuntimePolicySnapshot;
};
