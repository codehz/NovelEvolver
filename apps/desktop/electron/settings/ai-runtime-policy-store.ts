import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type {
  AiRuntimePolicySnapshot,
  AiRuntimePolicyWrite,
} from "@novelevolver/domain/settings/ai-settings";
import {
  AI_RUNTIME_POLICY_STATE_VERSION,
  AiRuntimePolicyState,
  parseAiRuntimePolicyState,
} from "@novelevolver/domain/settings/stores/ai-runtime-policy-state";

export class AiRuntimePolicyStore {
  readonly #filePath: string;
  readonly #state: AiRuntimePolicyState;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#state = new AiRuntimePolicyState(this.#load());
  }

  getSnapshot(): AiRuntimePolicySnapshot {
    return this.#state.getSnapshot();
  }

  setPolicy(input: AiRuntimePolicyWrite): AiRuntimePolicySnapshot {
    const snapshot = this.#state.setPolicy(input);
    this.#persist();
    return snapshot;
  }

  #load(): AiRuntimePolicySnapshot {
    if (!existsSync(this.#filePath)) {
      return parseAiRuntimePolicyState(null);
    }
    try {
      const parsed = JSON.parse(readFileSync(this.#filePath, "utf8")) as {
        version?: unknown;
      } & Record<string, unknown>;
      if (parsed.version !== AI_RUNTIME_POLICY_STATE_VERSION) {
        return parseAiRuntimePolicyState(null);
      }
      return parseAiRuntimePolicyState(parsed);
    } catch {
      return parseAiRuntimePolicyState(null);
    }
  }

  #persist(): void {
    mkdirSync(dirname(this.#filePath), { recursive: true });
    writeFileSync(
      this.#filePath,
      `${JSON.stringify({ version: AI_RUNTIME_POLICY_STATE_VERSION, ...this.#state.serialize() }, null, 2)}\n`,
      "utf8",
    );
  }
}
