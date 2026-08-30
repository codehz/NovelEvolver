import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { AiRuntimePolicySnapshot, AiRuntimePolicyWrite } from "#domain/settings/ai-settings";
import { DEFAULT_AI_RUNTIME_POLICY, normalizeAiRuntimePolicy } from "#domain/settings/ai-settings";

const FILE_VERSION = 1 as const;

type StoredFile = {
  version: typeof FILE_VERSION;
} & AiRuntimePolicySnapshot;

function toStored(policy: AiRuntimePolicySnapshot): StoredFile {
  return {
    version: FILE_VERSION,
    ...policy,
  };
}

/**
 * Persists global AI runtime budgets (tool loops + subagent focus injection).
 * Missing / corrupt files fall back to `DEFAULT_AI_RUNTIME_POLICY`.
 */
export class AiRuntimePolicyStore {
  readonly #filePath: string;
  #data: StoredFile;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#data = this.#load();
  }

  getSnapshot(): AiRuntimePolicySnapshot {
    return {
      maxToolRounds: this.#data.maxToolRounds,
      maxSubagentToolRounds: this.#data.maxSubagentToolRounds,
      maxParallelReadOnlySubagents: this.#data.maxParallelReadOnlySubagents,
      maxParentSummaryChars: this.#data.maxParentSummaryChars,
      maxFocusTargets: this.#data.maxFocusTargets,
      maxFocusContentChars: this.#data.maxFocusContentChars,
    };
  }

  setPolicy(input: AiRuntimePolicyWrite): AiRuntimePolicySnapshot {
    if (input == null || typeof input !== "object") {
      throw new Error("运行策略不能为空。");
    }
    const next = normalizeAiRuntimePolicy(input);
    this.#data = toStored(next);
    this.#persist();
    return this.getSnapshot();
  }

  #load(): StoredFile {
    if (!existsSync(this.#filePath)) {
      return toStored(DEFAULT_AI_RUNTIME_POLICY);
    }
    try {
      const parsed = JSON.parse(readFileSync(this.#filePath, "utf8")) as Partial<StoredFile>;
      return toStored(normalizeAiRuntimePolicy(parsed));
    } catch {
      return toStored(DEFAULT_AI_RUNTIME_POLICY);
    }
  }

  #persist(): void {
    mkdirSync(dirname(this.#filePath), { recursive: true });
    writeFileSync(this.#filePath, `${JSON.stringify(this.#data, null, 2)}\n`, "utf8");
  }
}
