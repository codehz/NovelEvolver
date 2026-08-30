import type {
  AiPromptConfigPublic,
  AiPromptConfigWrite,
  AiPromptsSettingsSnapshot,
} from "../ai-settings";
import { isAiPromptSlug } from "../ai-settings";
import type { CreateId } from "../create-id";

export const AI_PROMPTS_STATE_VERSION = 1 as const;

export type AiPromptsStateData = {
  prompts: AiPromptConfigPublic[];
};

export const EMPTY_AI_PROMPTS_STATE: AiPromptsStateData = { prompts: [] };

type AiPromptsStateOptions = {
  createId: CreateId;
  data?: AiPromptsStateData;
};

export class AiPromptsState {
  readonly #createId: CreateId;
  #data: AiPromptsStateData;

  constructor(options: AiPromptsStateOptions) {
    this.#createId = options.createId;
    this.#data = options.data ?? { prompts: [] };
  }

  getSnapshot(): AiPromptsSettingsSnapshot {
    return {
      prompts: this.#data.prompts.map((entry) => ({ ...entry })),
    };
  }

  serialize(): AiPromptsStateData {
    return {
      prompts: this.#data.prompts.map((entry) => ({ ...entry })),
    };
  }

  upsert(input: AiPromptConfigWrite): AiPromptsSettingsSnapshot {
    const title = input.title.trim();
    const slug = input.slug.trim();
    const prompt = input.prompt.trim();

    if (title === "") {
      throw new Error("提示词标题不能为空。");
    }
    if (slug === "") {
      throw new Error("调用名不能为空。");
    }
    if (!isAiPromptSlug(slug)) {
      throw new Error("调用名须为小写字母开头，仅含 a-z、0-9、_、-。");
    }
    if (prompt === "") {
      throw new Error("提示词内容不能为空。");
    }

    const duplicate = this.#data.prompts.find(
      (entry) => entry.slug === slug && entry.id !== input.id,
    );
    if (duplicate) {
      throw new Error(`调用名「${slug}」已被使用。`);
    }

    if (input.id) {
      const index = this.#data.prompts.findIndex((entry) => entry.id === input.id);
      if (index < 0) {
        throw new Error("提示词不存在。");
      }
      this.#data.prompts[index] = {
        id: input.id,
        title,
        slug,
        prompt,
      };
    } else {
      this.#data.prompts.push({
        id: this.#createId(),
        title,
        slug,
        prompt,
      });
    }

    return this.getSnapshot();
  }

  remove(id: string): AiPromptsSettingsSnapshot {
    const next = this.#data.prompts.filter((entry) => entry.id !== id);
    if (next.length === this.#data.prompts.length) {
      throw new Error("提示词不存在。");
    }
    this.#data.prompts = next;
    return this.getSnapshot();
  }
}

export function parseAiPromptsState(value: unknown): AiPromptsStateData {
  if (value == null || typeof value !== "object") {
    return { prompts: [] };
  }
  const record = value as Partial<AiPromptsStateData>;
  const prompts = Array.isArray(record.prompts)
    ? record.prompts.filter(isStoredPromptRecord).map((entry) => ({
        id: entry.id,
        title: entry.title,
        slug: entry.slug,
        prompt: entry.prompt,
      }))
    : [];
  return { prompts };
}

function isStoredPromptRecord(value: unknown): value is AiPromptConfigPublic {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<AiPromptConfigPublic>;
  return (
    typeof record.id === "string" &&
    record.id !== "" &&
    typeof record.title === "string" &&
    typeof record.slug === "string" &&
    typeof record.prompt === "string"
  );
}
