import type {
  AiAgentConfigWrite,
  AiAgentsSettingsSnapshot,
  AiModelConfigWrite,
  AiModelsSettingsSnapshot,
  AiPromptConfigWrite,
  AiPromptsSettingsSnapshot,
  AiRuntimePolicySnapshot,
  AiRuntimePolicyWrite,
  GitCredentialConfigWrite,
  GitCredentialsSettingsSnapshot,
  AiProviderConfigWrite,
} from "@novelevolver/domain/settings/ai-settings";
import type { RpcTarget } from "capnweb";

export interface SettingsService extends RpcTarget {
  getAiModels(): AiModelsSettingsSnapshot;
  upsertAiProvider(input: AiProviderConfigWrite): AiModelsSettingsSnapshot;
  removeAiProvider(id: string): AiModelsSettingsSnapshot;
  upsertAiModel(input: AiModelConfigWrite): AiModelsSettingsSnapshot;
  removeAiModel(id: string): AiModelsSettingsSnapshot;
  setDefaultAiModel(id: string | null): AiModelsSettingsSnapshot;
  getAiAgents(): AiAgentsSettingsSnapshot;
  upsertAiAgent(input: AiAgentConfigWrite): AiAgentsSettingsSnapshot;
  removeAiAgent(id: string): AiAgentsSettingsSnapshot;
  getAiPrompts(): AiPromptsSettingsSnapshot;
  upsertAiPrompt(input: AiPromptConfigWrite): AiPromptsSettingsSnapshot;
  removeAiPrompt(id: string): AiPromptsSettingsSnapshot;
  getAiRuntimePolicy(): AiRuntimePolicySnapshot;
  setAiRuntimePolicy(input: AiRuntimePolicyWrite): AiRuntimePolicySnapshot;
  getGitCredentials(): GitCredentialsSettingsSnapshot;
  upsertGitCredential(input: GitCredentialConfigWrite): GitCredentialsSettingsSnapshot;
  removeGitCredential(id: string): GitCredentialsSettingsSnapshot;
}
