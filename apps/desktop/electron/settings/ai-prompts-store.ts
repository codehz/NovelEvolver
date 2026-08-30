import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { nanoid } from "nanoid";

import type { AiPromptConfigWrite, AiPromptsSettingsSnapshot } from "#domain/settings/ai-settings";
import {
  AI_PROMPTS_STATE_VERSION,
  AiPromptsState,
  parseAiPromptsState,
} from "#domain/settings/stores/ai-prompts-state";

export class AiPromptsStore {
  readonly #filePath: string;
  readonly #state: AiPromptsState;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#state = new AiPromptsState({
      createId: () => nanoid(12),
      data: this.#load(),
    });
  }

  getSnapshot(): AiPromptsSettingsSnapshot {
    return this.#state.getSnapshot();
  }

  upsert(input: AiPromptConfigWrite): AiPromptsSettingsSnapshot {
    const snapshot = this.#state.upsert(input);
    this.#persist();
    return snapshot;
  }

  remove(id: string): AiPromptsSettingsSnapshot {
    const snapshot = this.#state.remove(id);
    this.#persist();
    return snapshot;
  }

  #load() {
    if (!existsSync(this.#filePath)) {
      return parseAiPromptsState(null);
    }
    try {
      const parsed = JSON.parse(readFileSync(this.#filePath, "utf8")) as {
        version?: unknown;
      } & Record<string, unknown>;
      if (parsed.version !== AI_PROMPTS_STATE_VERSION) {
        return parseAiPromptsState(null);
      }
      return parseAiPromptsState(parsed);
    } catch {
      return parseAiPromptsState(null);
    }
  }

  #persist(): void {
    mkdirSync(dirname(this.#filePath), { recursive: true });
    writeFileSync(
      this.#filePath,
      `${JSON.stringify({ version: AI_PROMPTS_STATE_VERSION, ...this.#state.serialize() }, null, 2)}\n`,
      "utf8",
    );
  }
}
