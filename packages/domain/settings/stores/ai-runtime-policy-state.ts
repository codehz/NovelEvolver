import type { AiRuntimePolicySnapshot, AiRuntimePolicyWrite } from "../ai-settings";
import { DEFAULT_AI_RUNTIME_POLICY, normalizeAiRuntimePolicy } from "../ai-settings";

export const AI_RUNTIME_POLICY_STATE_VERSION = 1 as const;

export class AiRuntimePolicyState {
  #policy: AiRuntimePolicySnapshot;

  constructor(policy?: AiRuntimePolicySnapshot) {
    this.#policy = policy ?? DEFAULT_AI_RUNTIME_POLICY;
  }

  getSnapshot(): AiRuntimePolicySnapshot {
    return { ...this.#policy };
  }

  serialize(): AiRuntimePolicySnapshot {
    return { ...this.#policy };
  }

  setPolicy(input: AiRuntimePolicyWrite): AiRuntimePolicySnapshot {
    if (input == null || typeof input !== "object") {
      throw new Error("运行策略不能为空。");
    }
    this.#policy = normalizeAiRuntimePolicy(input);
    return this.getSnapshot();
  }
}

export function parseAiRuntimePolicyState(value: unknown): AiRuntimePolicySnapshot {
  if (value == null || typeof value !== "object") {
    return { ...DEFAULT_AI_RUNTIME_POLICY };
  }
  return normalizeAiRuntimePolicy(value as Partial<AiRuntimePolicyWrite>);
}
