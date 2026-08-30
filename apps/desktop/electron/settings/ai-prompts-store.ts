import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { nanoid } from "nanoid";

import type {
  AiPromptConfigPublic,
  AiPromptConfigWrite,
  AiPromptsSettingsSnapshot,
} from "#domain/settings/ai-settings";
import { isAiPromptSlug } from "#domain/settings/ai-settings";

const FILE_VERSION = 1 as const;

type StoredPromptRecord = AiPromptConfigPublic;

type StoredFile = {
  version: typeof FILE_VERSION;
  prompts: StoredPromptRecord[];
};

const EMPTY_FILE: StoredFile = { version: FILE_VERSION, prompts: [] };

function toPublic(record: StoredPromptRecord): AiPromptConfigPublic {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    prompt: record.prompt,
  };
}

export class AiPromptsStore {
  readonly #filePath: string;
  #data: StoredFile;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#data = this.#load();
  }

  getSnapshot(): AiPromptsSettingsSnapshot {
    return {
      prompts: this.#data.prompts.map(toPublic),
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
        id: nanoid(12),
        title,
        slug,
        prompt,
      });
    }

    this.#persist();
    return this.getSnapshot();
  }

  remove(id: string): AiPromptsSettingsSnapshot {
    const next = this.#data.prompts.filter((entry) => entry.id !== id);
    if (next.length === this.#data.prompts.length) {
      throw new Error("提示词不存在。");
    }
    this.#data.prompts = next;
    this.#persist();
    return this.getSnapshot();
  }

  #load(): StoredFile {
    if (!existsSync(this.#filePath)) {
      return { ...EMPTY_FILE, prompts: [] };
    }
    try {
      const parsed = JSON.parse(readFileSync(this.#filePath, "utf8")) as Partial<StoredFile>;
      const prompts = Array.isArray(parsed.prompts)
        ? parsed.prompts.filter(isStoredPromptRecord).map((entry) => ({
            id: entry.id,
            title: entry.title,
            slug: entry.slug,
            prompt: entry.prompt,
          }))
        : [];
      return {
        version: FILE_VERSION,
        prompts,
      };
    } catch {
      return { ...EMPTY_FILE, prompts: [] };
    }
  }

  #persist(): void {
    mkdirSync(dirname(this.#filePath), { recursive: true });
    writeFileSync(this.#filePath, `${JSON.stringify(this.#data, null, 2)}\n`, "utf8");
  }
}

function isStoredPromptRecord(value: unknown): value is StoredPromptRecord {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<StoredPromptRecord>;
  return (
    typeof record.id === "string" &&
    record.id !== "" &&
    typeof record.title === "string" &&
    typeof record.slug === "string" &&
    typeof record.prompt === "string"
  );
}
