import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { nanoid } from "nanoid";

import type {
  AiAgentConfigPublic,
  AiAgentConfigWrite,
  AiAgentsSettingsSnapshot,
  BuiltinAiAgentId,
} from "#shared/rpc/services/index";
import {
  BUILTIN_AI_AGENT_ID,
  BUILTIN_AI_AGENT_IDS,
  BUILTIN_CHAPTER_WRITER_ID,
  BUILTIN_CONSISTENCY_REVIEWER_ID,
  isBuiltinAiAgentId,
} from "#shared/rpc/services/index";

import { DEFAULT_AI_SYSTEM_PROMPT } from "../ai/default-system-prompt";
import {
  CHAPTER_WRITER_SYSTEM_PROMPT,
  CONSISTENCY_REVIEWER_SYSTEM_PROMPT,
} from "../ai/specialist-system-prompts";
import { AI_TOOL_CATALOG, AI_TOOL_NAMES } from "../ai/tools";
import type { AiModelsStore } from "./ai-models-store";

const FILE_VERSION = 1 as const;

export const BUILTIN_AI_AGENT_SYSTEM_PROMPT = DEFAULT_AI_SYSTEM_PROMPT;

export type AiAgentRuntimeConfig = AiAgentConfigPublic;

type StoredAgentRecord = Omit<AiAgentConfigPublic, "builtin">;

/** Per-builtin override: null clears to “inherit chat default”. Missing key = no override. */
type BuiltinDefaultModelIds = Partial<Record<BuiltinAiAgentId, string | null>>;

type StoredFile = {
  version: typeof FILE_VERSION;
  agents: StoredAgentRecord[];
  builtinDefaultModelIds: BuiltinDefaultModelIds;
};

const EMPTY_FILE: StoredFile = {
  version: FILE_VERSION,
  agents: [],
  builtinDefaultModelIds: {},
};

const ALL_TOOL_NAMES = Object.keys(AI_TOOL_NAMES);

const READ_TOOL_NAMES = [
  "read_structure",
  "read_document",
  "search_documents",
  "read_changes",
  "read_change",
  "read_history",
  "read_history_entry",
] as const;

const CHAPTER_WRITER_TOOL_NAMES = [
  ...READ_TOOL_NAMES,
  "write_document",
  "replace_document_text",
  "create_document",
  "create_folder",
] as const;

function builtinWritingAssistant(): AiAgentConfigPublic {
  return {
    id: BUILTIN_AI_AGENT_ID,
    name: "写作助手",
    systemPrompt: BUILTIN_AI_AGENT_SYSTEM_PROMPT,
    defaultModelId: null,
    availableToolNames: [...ALL_TOOL_NAMES],
    builtin: true,
  };
}

function builtinConsistencyReviewer(): AiAgentConfigPublic {
  return {
    id: BUILTIN_CONSISTENCY_REVIEWER_ID,
    name: "一致性审查",
    systemPrompt: CONSISTENCY_REVIEWER_SYSTEM_PROMPT,
    defaultModelId: null,
    availableToolNames: [...READ_TOOL_NAMES],
    builtin: true,
  };
}

function builtinChapterWriter(): AiAgentConfigPublic {
  return {
    id: BUILTIN_CHAPTER_WRITER_ID,
    name: "章节续写",
    systemPrompt: CHAPTER_WRITER_SYSTEM_PROMPT,
    defaultModelId: null,
    availableToolNames: [...CHAPTER_WRITER_TOOL_NAMES],
    builtin: true,
  };
}

function builtinAgents(): AiAgentConfigPublic[] {
  return [builtinWritingAssistant(), builtinConsistencyReviewer(), builtinChapterWriter()];
}

function parseBuiltinDefaultModelIds(raw: unknown): BuiltinDefaultModelIds {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: BuiltinDefaultModelIds = {};
  for (const id of BUILTIN_AI_AGENT_IDS) {
    if (!Object.prototype.hasOwnProperty.call(raw, id)) {
      continue;
    }
    const value = (raw as Record<string, unknown>)[id];
    if (value === null || typeof value === "string") {
      result[id] = value;
    }
  }
  return result;
}

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
        ...this.#mergedBuiltinAgents(),
        ...this.#data.agents.map((agent) => ({ ...agent, builtin: false as const })),
      ],
      tools: AI_TOOL_CATALOG.map((tool) => ({ ...tool })),
    };
  }

  getRuntimeConfig(id: string): AiAgentRuntimeConfig {
    return (
      this.getSnapshot().agents.find((agent) => agent.id === id) ??
      this.#mergedBuiltin(builtinWritingAssistant())
    );
  }

  /** Exact lookup without falling back to the default writing assistant. */
  findRuntimeConfig(id: string): AiAgentRuntimeConfig | null {
    return this.getSnapshot().agents.find((agent) => agent.id === id) ?? null;
  }

  upsert(input: AiAgentConfigWrite): AiAgentsSettingsSnapshot {
    if (input.id !== undefined && isBuiltinAiAgentId(input.id)) {
      return this.#upsertBuiltinDefaultModel(input.id, input.defaultModelId);
    }

    const name = input.name.trim();
    const systemPrompt = input.systemPrompt.trim();
    if (name === "") {
      throw new Error("Agent 名称不能为空。");
    }
    if (systemPrompt === "") {
      throw new Error("系统提示词不能为空。");
    }
    this.#assertDefaultModelId(input.defaultModelId);

    const availableToolNames = [...new Set(input.availableToolNames)];
    if (availableToolNames.some((toolName) => !(toolName in AI_TOOL_NAMES))) {
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
    if (isBuiltinAiAgentId(id)) {
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

  #upsertBuiltinDefaultModel(
    id: BuiltinAiAgentId,
    defaultModelId: string | null,
  ): AiAgentsSettingsSnapshot {
    this.#assertDefaultModelId(defaultModelId);
    // Only defaultModelId is user-configurable for builtins; name/prompt/tools stay code-defined.
    if (defaultModelId === null) {
      const { [id]: _removed, ...rest } = this.#data.builtinDefaultModelIds;
      this.#data.builtinDefaultModelIds = rest;
    } else {
      this.#data.builtinDefaultModelIds = {
        ...this.#data.builtinDefaultModelIds,
        [id]: defaultModelId,
      };
    }
    this.#persist();
    return this.getSnapshot();
  }

  #assertDefaultModelId(defaultModelId: string | null): void {
    if (
      defaultModelId !== null &&
      !this.#getAiModelsStore()
        .getSnapshot()
        .models.some((model) => model.id === defaultModelId)
    ) {
      throw new Error("默认模型不存在。");
    }
  }

  #mergedBuiltinAgents(): AiAgentConfigPublic[] {
    return builtinAgents().map((agent) => this.#mergedBuiltin(agent));
  }

  #mergedBuiltin(agent: AiAgentConfigPublic): AiAgentConfigPublic {
    if (!isBuiltinAiAgentId(agent.id)) {
      return agent;
    }
    const override = this.#data.builtinDefaultModelIds[agent.id];
    return {
      ...agent,
      defaultModelId: override === undefined ? null : override,
    };
  }

  #load(): StoredFile {
    if (!existsSync(this.#filePath)) {
      return { ...EMPTY_FILE, agents: [], builtinDefaultModelIds: {} };
    }
    try {
      const parsed = JSON.parse(readFileSync(this.#filePath, "utf8")) as Partial<StoredFile>;
      return {
        version: FILE_VERSION,
        agents: Array.isArray(parsed.agents) ? parsed.agents : [],
        builtinDefaultModelIds: parseBuiltinDefaultModelIds(parsed.builtinDefaultModelIds),
      };
    } catch {
      return { ...EMPTY_FILE, agents: [], builtinDefaultModelIds: {} };
    }
  }

  #persist(): void {
    mkdirSync(dirname(this.#filePath), { recursive: true });
    writeFileSync(this.#filePath, `${JSON.stringify(this.#data, null, 2)}\n`, "utf8");
  }
}
