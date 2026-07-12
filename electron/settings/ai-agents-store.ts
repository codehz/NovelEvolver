import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { nanoid } from "nanoid";

import type {
  AiAgentConfigPublic,
  AiAgentConfigWrite,
  AiAgentsSettingsSnapshot,
} from "#shared/rpc/services/index";
import { BUILTIN_AI_AGENT_ID } from "#shared/rpc/services/index";

import { AI_TOOL_CATALOG, AI_TOOL_NAMES } from "../ai/tools/definitions";
import type { AiModelsStore } from "./ai-models-store";

const FILE_VERSION = 1 as const;

export const BUILTIN_AI_AGENT_SYSTEM_PROMPT =
  "你是 NovelEvolver 的写作助手。请基于当前小说项目和对话上下文提供准确、简洁、可执行的帮助；需要读取或修改项目内容时使用提供的工具。";

export type AiAgentRuntimeConfig = AiAgentConfigPublic;

type StoredAgentRecord = Omit<AiAgentConfigPublic, "builtin">;

type StoredFile = {
  version: typeof FILE_VERSION;
  agents: StoredAgentRecord[];
};

const EMPTY_FILE: StoredFile = { version: FILE_VERSION, agents: [] };

export class AiAgentsStore {
  readonly #filePath: string;
  readonly #getAiModelsStore: () => AiModelsStore;
  #data: StoredFile;

  constructor(filePath: string, getAiModelsStore: () => AiModelsStore) {
    this.#filePath = filePath;
    this.#getAiModelsStore = getAiModelsStore;
    this.#data = this.#load();
  }

  getSnapshot(): AiAgentsSettingsSnapshot {
    return {
      agents: [
        this.#builtinAgent(),
        ...this.#data.agents.map((agent) => ({ ...agent, builtin: false })),
      ],
      tools: AI_TOOL_CATALOG.map((tool) => ({ ...tool })),
    };
  }

  getRuntimeConfig(id: string): AiAgentRuntimeConfig {
    return this.getSnapshot().agents.find((agent) => agent.id === id) ?? this.#builtinAgent();
  }

  upsert(input: AiAgentConfigWrite): AiAgentsSettingsSnapshot {
    const name = input.name.trim();
    const systemPrompt = input.systemPrompt.trim();
    if (name === "") {
      throw new Error("Agent 名称不能为空。");
    }
    if (systemPrompt === "") {
      throw new Error("系统提示词不能为空。");
    }
    if (input.id === BUILTIN_AI_AGENT_ID) {
      throw new Error("内置 Agent 无法修改。");
    }
    if (
      input.defaultModelId !== null &&
      !this.#getAiModelsStore()
        .getSnapshot()
        .models.some((model) => model.id === input.defaultModelId)
    ) {
      throw new Error("默认模型不存在。");
    }

    const availableToolNames = [...new Set(input.availableToolNames)];
    if (availableToolNames.some((name) => !(name in AI_TOOL_NAMES))) {
      throw new Error("包含未知工具。");
    }

    const record: StoredAgentRecord = {
      id: input.id ?? nanoid(12),
      name,
      systemPrompt,
      defaultModelId: input.defaultModelId,
      availableToolNames,
    };
    if (input.id) {
      const index = this.#data.agents.findIndex((agent) => agent.id === input.id);
      if (index < 0) {
        throw new Error("Agent 不存在。");
      }
      this.#data.agents[index] = record;
    } else {
      this.#data.agents.push(record);
    }
    this.#persist();
    return this.getSnapshot();
  }

  remove(id: string): AiAgentsSettingsSnapshot {
    if (id === BUILTIN_AI_AGENT_ID) {
      throw new Error("内置 Agent 无法删除。");
    }
    const next = this.#data.agents.filter((agent) => agent.id !== id);
    if (next.length === this.#data.agents.length) {
      throw new Error("Agent 不存在。");
    }
    this.#data.agents = next;
    this.#persist();
    return this.getSnapshot();
  }

  #builtinAgent(): AiAgentConfigPublic {
    return {
      id: BUILTIN_AI_AGENT_ID,
      name: "写作助手",
      systemPrompt: BUILTIN_AI_AGENT_SYSTEM_PROMPT,
      defaultModelId: null,
      availableToolNames: Object.keys(AI_TOOL_NAMES),
      builtin: true,
    };
  }

  #load(): StoredFile {
    if (!existsSync(this.#filePath)) {
      return { ...EMPTY_FILE, agents: [] };
    }
    try {
      const parsed = JSON.parse(readFileSync(this.#filePath, "utf8")) as Partial<StoredFile>;
      return {
        version: FILE_VERSION,
        agents: Array.isArray(parsed.agents) ? parsed.agents : [],
      };
    } catch {
      return { ...EMPTY_FILE, agents: [] };
    }
  }

  #persist(): void {
    mkdirSync(dirname(this.#filePath), { recursive: true });
    writeFileSync(this.#filePath, `${JSON.stringify(this.#data, null, 2)}\n`, "utf8");
  }
}
