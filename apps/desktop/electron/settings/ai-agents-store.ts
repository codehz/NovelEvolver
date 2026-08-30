import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { nanoid } from "nanoid";

import { BUILTIN_AI_AGENT_SYSTEM_PROMPT } from "#domain/settings/ai-builtin-agents";
import { AI_AGENT_DESCRIPTION_MAX_LENGTH } from "#domain/settings/ai-settings";
import type { AiAgentConfigWrite, AiAgentsSettingsSnapshot } from "#domain/settings/ai-settings";
import {
  AI_AGENTS_STATE_VERSION,
  AiAgentsState,
  parseAiAgentsState,
  type AiAgentRuntimeConfig,
} from "#domain/settings/stores/ai-agents-state";

import type { AiModelsStore } from "./ai-models-store";

export { AI_AGENT_DESCRIPTION_MAX_LENGTH, BUILTIN_AI_AGENT_SYSTEM_PROMPT };
export type { AiAgentRuntimeConfig };

export class AiAgentsStore {
  readonly #filePath: string;
  readonly #state: AiAgentsState;

  constructor(filePath: string, getAiModelsStore: () => AiModelsStore) {
    this.#filePath = filePath;
    this.#state = new AiAgentsState({
      createId: () => nanoid(12),
      knownModelIds: () =>
        getAiModelsStore()
          .getSnapshot()
          .models.map((model) => model.id),
      data: this.#load(),
    });
  }

  getSnapshot(): AiAgentsSettingsSnapshot {
    return this.#state.getSnapshot();
  }

  getRuntimeConfig(id: string): AiAgentRuntimeConfig {
    return this.#state.getRuntimeConfig(id);
  }

  findRuntimeConfig(id: string): AiAgentRuntimeConfig | null {
    return this.#state.findRuntimeConfig(id);
  }

  upsert(input: AiAgentConfigWrite): AiAgentsSettingsSnapshot {
    const snapshot = this.#state.upsert(input);
    this.#persist();
    return snapshot;
  }

  remove(id: string): AiAgentsSettingsSnapshot {
    const snapshot = this.#state.remove(id);
    this.#persist();
    return snapshot;
  }

  #load() {
    if (!existsSync(this.#filePath)) {
      return parseAiAgentsState(null);
    }
    try {
      const parsed = JSON.parse(readFileSync(this.#filePath, "utf8")) as {
        version?: unknown;
      } & Record<string, unknown>;
      if (parsed.version !== AI_AGENTS_STATE_VERSION) {
        return parseAiAgentsState(null);
      }
      return parseAiAgentsState(parsed);
    } catch {
      return parseAiAgentsState(null);
    }
  }

  #persist(): void {
    mkdirSync(dirname(this.#filePath), { recursive: true });
    writeFileSync(
      this.#filePath,
      `${JSON.stringify({ version: AI_AGENTS_STATE_VERSION, ...this.#state.serialize() }, null, 2)}\n`,
      "utf8",
    );
  }
}
