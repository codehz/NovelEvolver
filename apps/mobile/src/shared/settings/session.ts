import type {
  AiAgentConfigWrite,
  AiModelConfigWrite,
  AiPromptConfigWrite,
  AiProviderConfigWrite,
  AiRuntimePolicyWrite,
} from "@novelevolver/domain/settings/ai-settings";
import {
  AI_AGENTS_STATE_VERSION,
  AiAgentsState,
  parseAiAgentsState,
} from "@novelevolver/domain/settings/stores/ai-agents-state";
import {
  AI_MODELS_STATE_VERSION,
  AiModelsState,
  parseAiModelsState,
} from "@novelevolver/domain/settings/stores/ai-models-state";
import {
  AI_PROMPTS_STATE_VERSION,
  AiPromptsState,
  parseAiPromptsState,
} from "@novelevolver/domain/settings/stores/ai-prompts-state";
import {
  AI_RUNTIME_POLICY_STATE_VERSION,
  AiRuntimePolicyState,
  parseAiRuntimePolicyState,
} from "@novelevolver/domain/settings/stores/ai-runtime-policy-state";

import { createSettingsId } from "./create-id";
import { readJson, settingsKv, writeJson, type SettingsKv } from "./kv";

const MODELS_KEY = "settings.ai-models";
const AGENTS_KEY = "settings.ai-agents";
const PROMPTS_KEY = "settings.ai-prompts";
const POLICY_KEY = "settings.ai-runtime-policy";

export class MobileSettingsSession {
  readonly models: AiModelsState;
  readonly agents: AiAgentsState;
  readonly prompts: AiPromptsState;
  readonly policy: AiRuntimePolicyState;
  readonly #kv: SettingsKv;

  constructor(kv: SettingsKv = settingsKv) {
    this.#kv = kv;
    this.models = new AiModelsState({
      createId: createSettingsId,
      data: parseVersioned(readJson(kv, MODELS_KEY), AI_MODELS_STATE_VERSION, parseAiModelsState),
    });
    this.agents = new AiAgentsState({
      createId: createSettingsId,
      knownModelIds: () => this.models.getSnapshot().models.map((model) => model.id),
      data: parseVersioned(readJson(kv, AGENTS_KEY), AI_AGENTS_STATE_VERSION, parseAiAgentsState),
    });
    this.prompts = new AiPromptsState({
      createId: createSettingsId,
      data: parseVersioned(
        readJson(kv, PROMPTS_KEY),
        AI_PROMPTS_STATE_VERSION,
        parseAiPromptsState,
      ),
    });
    this.policy = new AiRuntimePolicyState(
      parseVersioned(
        readJson(kv, POLICY_KEY),
        AI_RUNTIME_POLICY_STATE_VERSION,
        parseAiRuntimePolicyState,
      ),
    );
  }

  upsertProvider(input: AiProviderConfigWrite) {
    const snapshot = this.models.upsertProvider(input);
    this.#persistModels();
    return snapshot;
  }

  removeProvider(id: string) {
    const snapshot = this.models.removeProvider(id);
    this.#persistModels();
    return snapshot;
  }

  upsertModel(input: AiModelConfigWrite) {
    const snapshot = this.models.upsertModel(input);
    this.#persistModels();
    return snapshot;
  }

  removeModel(id: string) {
    const snapshot = this.models.removeModel(id);
    this.#persistModels();
    return snapshot;
  }

  setDefaultModel(id: string | null) {
    const snapshot = this.models.setDefault(id);
    this.#persistModels();
    return snapshot;
  }

  upsertAgent(input: AiAgentConfigWrite) {
    const snapshot = this.agents.upsert(input);
    this.#persistAgents();
    return snapshot;
  }

  removeAgent(id: string) {
    const snapshot = this.agents.remove(id);
    this.#persistAgents();
    return snapshot;
  }

  upsertPrompt(input: AiPromptConfigWrite) {
    const snapshot = this.prompts.upsert(input);
    this.#persistPrompts();
    return snapshot;
  }

  removePrompt(id: string) {
    const snapshot = this.prompts.remove(id);
    this.#persistPrompts();
    return snapshot;
  }

  setPolicy(input: AiRuntimePolicyWrite) {
    const snapshot = this.policy.setPolicy(input);
    this.#persistPolicy();
    return snapshot;
  }

  #persistModels(): void {
    writeJson(this.#kv, MODELS_KEY, {
      version: AI_MODELS_STATE_VERSION,
      ...this.models.serialize(),
    });
  }

  #persistAgents(): void {
    writeJson(this.#kv, AGENTS_KEY, {
      version: AI_AGENTS_STATE_VERSION,
      ...this.agents.serialize(),
    });
  }

  #persistPrompts(): void {
    writeJson(this.#kv, PROMPTS_KEY, {
      version: AI_PROMPTS_STATE_VERSION,
      ...this.prompts.serialize(),
    });
  }

  #persistPolicy(): void {
    writeJson(this.#kv, POLICY_KEY, {
      version: AI_RUNTIME_POLICY_STATE_VERSION,
      ...this.policy.serialize(),
    });
  }
}

function parseVersioned<T>(value: unknown, version: number, parse: (input: unknown) => T): T {
  if (value == null || typeof value !== "object") {
    return parse(null);
  }
  const record = value as { version?: unknown };
  if (record.version !== version) {
    return parse(null);
  }
  return parse(value);
}

let session: MobileSettingsSession | null = null;

export function getMobileSettings(): MobileSettingsSession {
  session ??= new MobileSettingsSession();
  return session;
}
