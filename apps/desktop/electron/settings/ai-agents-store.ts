import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { nanoid } from "nanoid";

import type {
  AiAgentConfigPublic,
  AiAgentConfigWrite,
  AiAgentsSettingsSnapshot,
  BuiltinAiAgentId,
} from "#domain/settings/ai-settings";
import {
  BUILTIN_AI_AGENT_ID,
  BUILTIN_AI_AGENT_IDS,
  BUILTIN_BRAINSTORM_ID,
  BUILTIN_CHAPTER_WRITER_ID,
  BUILTIN_CONSISTENCY_REVIEWER_ID,
  BUILTIN_ROLEPLAY_ID,
  isBuiltinAiAgentId,
} from "#domain/settings/ai-settings";

import { DEFAULT_AI_SYSTEM_PROMPT } from "../ai/default-system-prompt";
import {
  BRAINSTORM_SYSTEM_PROMPT,
  CHAPTER_WRITER_SYSTEM_PROMPT,
  CONSISTENCY_REVIEWER_SYSTEM_PROMPT,
  ROLEPLAY_SYSTEM_PROMPT,
} from "../ai/specialist-system-prompts";
import { AI_TOOL_CATALOG, AI_TOOL_NAMES } from "../ai/tools";
import type { AiModelsStore } from "./ai-models-store";

const FILE_VERSION = 2 as const;

export const BUILTIN_AI_AGENT_SYSTEM_PROMPT = DEFAULT_AI_SYSTEM_PROMPT;

export type AiAgentRuntimeConfig = AiAgentConfigPublic;

/** Max chars for agent description (settings UI + store normalize; multi-line OK). */
export const AI_AGENT_DESCRIPTION_MAX_LENGTH = 500;

type StoredAgentRecord = Omit<
  AiAgentConfigPublic,
  "builtin" | "defaultSystemPrompt" | "defaultDescription"
>;

/** Per-builtin override: null clears to “inherit chat default”. Missing key = no override. */
type BuiltinDefaultModelIds = Partial<Record<BuiltinAiAgentId, string | null>>;

type BuiltinSystemPromptOverrides = Partial<Record<BuiltinAiAgentId, string>>;

/**
 * Per-builtin description override.
 * Key present with string (including empty) = override; missing key = code default.
 */
type BuiltinDescriptionOverrides = Partial<Record<BuiltinAiAgentId, string>>;

/** Partial channel overrides for builtins; missing key/field = use code default. */
type BuiltinChannelOverride = {
  userSelectable?: boolean;
  subagentEligible?: boolean;
};

type BuiltinChannelOverrides = Partial<Record<BuiltinAiAgentId, BuiltinChannelOverride>>;

type StoredFile = {
  version: typeof FILE_VERSION;
  agents: StoredAgentRecord[];
  builtinDefaultModelIds: BuiltinDefaultModelIds;
  builtinSystemPromptOverrides: BuiltinSystemPromptOverrides;
  builtinDescriptionOverrides: BuiltinDescriptionOverrides;
  builtinChannelOverrides: BuiltinChannelOverrides;
};

const EMPTY_FILE: StoredFile = {
  version: FILE_VERSION,
  agents: [],
  builtinDefaultModelIds: {},
  builtinSystemPromptOverrides: {},
  builtinDescriptionOverrides: {},
  builtinChannelOverrides: {},
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

const BUILTIN_WRITING_ASSISTANT_DESCRIPTION = ["主对话写作助手，可使用完整工具并委派子代理。"].join(
  "\n",
);

const BUILTIN_CONSISTENCY_REVIEWER_DESCRIPTION = [
  "对照设定与正文做只读一致性审查。",
  "可扫描人设、世界观、时间线与事实冲突；不修改正文。",
].join("\n");

const BUILTIN_CHAPTER_WRITER_DESCRIPTION = [
  "可创建新章节，或按既有文风续写/改写并直接写回手稿。",
  "新建时在 task 写明父节点与标题；无需父代理先 create_document。",
  "focus 可传父 folder 或既有章节；勿塞空 chapter 浪费预算。",
].join("\n");

const BUILTIN_BRAINSTORM_DESCRIPTION = [
  "纯文本创意发散：围绕设定/情节产出多方案、利弊与组合建议，不调用工具。",
  "适合 plot fork、人设动机、场景变体、冲突设计等需要隔离上下文的构思任务。",
  "用 focus 预载相关设定/章节；task 写清约束（方案数量、格式、不要写什么）。",
].join("\n");

const BUILTIN_ROLEPLAY_DESCRIPTION = [
  "纯文本创意人格：固定视角/文风产出 prose，不调用工具。",
  "适合反派视角改写、老编辑口吻润色、角色对话演练等委派任务。",
  "需要使用 focus 来预载段落和设定；task 写清人格与输出形式。",
].join("\n");

/** Normalize multi-line description: LF newlines, per-line trim, cap length. */
function normalizeDescription(value: string): string {
  const lines = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  while (lines.length > 0 && lines[0] === "") {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.join("\n").slice(0, AI_AGENT_DESCRIPTION_MAX_LENGTH);
}

function builtinWritingAssistant(): AiAgentConfigPublic {
  return {
    id: BUILTIN_AI_AGENT_ID,
    name: "写作助手",
    description: BUILTIN_WRITING_ASSISTANT_DESCRIPTION,
    defaultDescription: BUILTIN_WRITING_ASSISTANT_DESCRIPTION,
    systemPrompt: BUILTIN_AI_AGENT_SYSTEM_PROMPT,
    defaultSystemPrompt: BUILTIN_AI_AGENT_SYSTEM_PROMPT,
    defaultModelId: null,
    availableToolNames: [...ALL_TOOL_NAMES],
    builtin: true,
    userSelectable: true,
    subagentEligible: false,
    textOnlyMode: false,
  };
}

function builtinConsistencyReviewer(): AiAgentConfigPublic {
  return {
    id: BUILTIN_CONSISTENCY_REVIEWER_ID,
    name: "一致性审查",
    description: BUILTIN_CONSISTENCY_REVIEWER_DESCRIPTION,
    defaultDescription: BUILTIN_CONSISTENCY_REVIEWER_DESCRIPTION,
    systemPrompt: CONSISTENCY_REVIEWER_SYSTEM_PROMPT,
    defaultSystemPrompt: CONSISTENCY_REVIEWER_SYSTEM_PROMPT,
    defaultModelId: null,
    availableToolNames: [...READ_TOOL_NAMES],
    builtin: true,
    userSelectable: false,
    subagentEligible: true,
    textOnlyMode: false,
  };
}

function builtinChapterWriter(): AiAgentConfigPublic {
  return {
    id: BUILTIN_CHAPTER_WRITER_ID,
    name: "章节续写",
    description: BUILTIN_CHAPTER_WRITER_DESCRIPTION,
    defaultDescription: BUILTIN_CHAPTER_WRITER_DESCRIPTION,
    systemPrompt: CHAPTER_WRITER_SYSTEM_PROMPT,
    defaultSystemPrompt: CHAPTER_WRITER_SYSTEM_PROMPT,
    defaultModelId: null,
    availableToolNames: [...CHAPTER_WRITER_TOOL_NAMES],
    builtin: true,
    userSelectable: false,
    subagentEligible: true,
    textOnlyMode: false,
  };
}

function builtinBrainstorm(): AiAgentConfigPublic {
  return {
    id: BUILTIN_BRAINSTORM_ID,
    name: "头脑风暴",
    description: BUILTIN_BRAINSTORM_DESCRIPTION,
    defaultDescription: BUILTIN_BRAINSTORM_DESCRIPTION,
    systemPrompt: BRAINSTORM_SYSTEM_PROMPT,
    defaultSystemPrompt: BRAINSTORM_SYSTEM_PROMPT,
    defaultModelId: null,
    availableToolNames: [],
    builtin: true,
    userSelectable: false,
    subagentEligible: true,
    textOnlyMode: true,
  };
}

function builtinRoleplay(): AiAgentConfigPublic {
  return {
    id: BUILTIN_ROLEPLAY_ID,
    name: "角色扮演",
    description: BUILTIN_ROLEPLAY_DESCRIPTION,
    defaultDescription: BUILTIN_ROLEPLAY_DESCRIPTION,
    systemPrompt: ROLEPLAY_SYSTEM_PROMPT,
    defaultSystemPrompt: ROLEPLAY_SYSTEM_PROMPT,
    defaultModelId: null,
    availableToolNames: [],
    builtin: true,
    userSelectable: false,
    subagentEligible: true,
    textOnlyMode: true,
  };
}

/** Missing flags on legacy custom agents default to both enabled. */
function parseBooleanFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeStoredAgent(raw: unknown): StoredAgentRecord | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Partial<StoredAgentRecord> & { id?: unknown };
  if (typeof record.id !== "string" || record.id.trim() === "") {
    return null;
  }
  if (typeof record.name !== "string" || typeof record.systemPrompt !== "string") {
    return null;
  }
  if (!Array.isArray(record.availableToolNames)) {
    return null;
  }
  const defaultModelId =
    record.defaultModelId === null || typeof record.defaultModelId === "string"
      ? record.defaultModelId
      : null;

  const description =
    typeof record.description === "string" ? normalizeDescription(record.description) : "";

  const subagentEligible = parseBooleanFlag(record.subagentEligible, true);
  const textOnlyMode = normalizeAgentTextOnlyMode(
    subagentEligible,
    parseBooleanFlag(record.textOnlyMode, false),
  );

  return {
    id: record.id,
    name: record.name,
    description,
    systemPrompt: record.systemPrompt,
    defaultModelId,
    availableToolNames: record.availableToolNames.filter(
      (name): name is string => typeof name === "string",
    ),
    userSelectable: parseBooleanFlag(record.userSelectable, true),
    subagentEligible,
    textOnlyMode,
  };
}

function normalizeAgentTextOnlyMode(subagentEligible: boolean, textOnlyMode: boolean): boolean {
  return subagentEligible && textOnlyMode;
}

function builtinAgents(): AiAgentConfigPublic[] {
  return [
    builtinWritingAssistant(),
    builtinConsistencyReviewer(),
    builtinChapterWriter(),
    builtinBrainstorm(),
    builtinRoleplay(),
  ];
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

function parseBuiltinSystemPromptOverrides(raw: unknown): BuiltinSystemPromptOverrides {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: BuiltinSystemPromptOverrides = {};
  for (const id of BUILTIN_AI_AGENT_IDS) {
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value === "string" && value.trim() !== "") {
      result[id] = value.trim();
    }
  }
  return result;
}

function parseBuiltinDescriptionOverrides(raw: unknown): BuiltinDescriptionOverrides {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: BuiltinDescriptionOverrides = {};
  for (const id of BUILTIN_AI_AGENT_IDS) {
    if (!Object.prototype.hasOwnProperty.call(raw, id)) {
      continue;
    }
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value === "string") {
      // Allow empty string override (user cleared the default).
      result[id] = normalizeDescription(value);
    }
  }
  return result;
}

function parseBuiltinChannelOverrides(raw: unknown): BuiltinChannelOverrides {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const result: BuiltinChannelOverrides = {};
  for (const id of BUILTIN_AI_AGENT_IDS) {
    const value = (raw as Record<string, unknown>)[id];
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const record = value as Partial<BuiltinChannelOverride>;
    const override: BuiltinChannelOverride = {};
    if (typeof record.userSelectable === "boolean") {
      override.userSelectable = record.userSelectable;
    }
    if (typeof record.subagentEligible === "boolean") {
      override.subagentEligible = record.subagentEligible;
    }
    if (override.userSelectable !== undefined || override.subagentEligible !== undefined) {
      result[id] = override;
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
        ...this.#data.agents.map((agent) => ({
          ...agent,
          defaultDescription: null,
          defaultSystemPrompt: null,
          builtin: false as const,
        })),
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
      return this.#upsertBuiltin(input.id, input);
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
      description: normalizeDescription(input.description),
      systemPrompt,
      defaultModelId: input.defaultModelId,
      availableToolNames,
      userSelectable: input.userSelectable,
      subagentEligible: input.subagentEligible,
      textOnlyMode: normalizeAgentTextOnlyMode(input.subagentEligible, input.textOnlyMode),
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

  #upsertBuiltin(id: BuiltinAiAgentId, input: AiAgentConfigWrite): AiAgentsSettingsSnapshot {
    const defaultModelId = input.defaultModelId;
    this.#assertDefaultModelId(defaultModelId);
    const systemPrompt = input.systemPrompt.trim();
    if (systemPrompt === "") {
      throw new Error("系统提示词不能为空。");
    }

    if (defaultModelId === null) {
      const { [id]: _removed, ...rest } = this.#data.builtinDefaultModelIds;
      this.#data.builtinDefaultModelIds = rest;
    } else {
      this.#data.builtinDefaultModelIds = {
        ...this.#data.builtinDefaultModelIds,
        [id]: defaultModelId,
      };
    }

    const baseline = builtinAgents().find((agent) => agent.id === id)!;
    if (systemPrompt === baseline.systemPrompt) {
      const { [id]: _removed, ...rest } = this.#data.builtinSystemPromptOverrides;
      this.#data.builtinSystemPromptOverrides = rest;
    } else {
      this.#data.builtinSystemPromptOverrides = {
        ...this.#data.builtinSystemPromptOverrides,
        [id]: systemPrompt,
      };
    }

    const description = normalizeDescription(input.description);
    if (description === baseline.description) {
      const { [id]: _removed, ...rest } = this.#data.builtinDescriptionOverrides;
      this.#data.builtinDescriptionOverrides = rest;
    } else {
      this.#data.builtinDescriptionOverrides = {
        ...this.#data.builtinDescriptionOverrides,
        [id]: description,
      };
    }

    const nextChannel: BuiltinChannelOverride = {};
    if (input.userSelectable !== baseline.userSelectable) {
      nextChannel.userSelectable = input.userSelectable;
    }
    if (input.subagentEligible !== baseline.subagentEligible) {
      nextChannel.subagentEligible = input.subagentEligible;
    }
    if (nextChannel.userSelectable === undefined && nextChannel.subagentEligible === undefined) {
      const { [id]: _removed, ...rest } = this.#data.builtinChannelOverrides;
      this.#data.builtinChannelOverrides = rest;
    } else {
      this.#data.builtinChannelOverrides = {
        ...this.#data.builtinChannelOverrides,
        [id]: nextChannel,
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
    const systemPromptOverride = this.#data.builtinSystemPromptOverrides[agent.id];
    const descriptionOverride = this.#data.builtinDescriptionOverrides[agent.id];
    const channelOverride = this.#data.builtinChannelOverrides[agent.id];
    return {
      ...agent,
      description: descriptionOverride === undefined ? agent.description : descriptionOverride,
      systemPrompt: systemPromptOverride ?? agent.systemPrompt,
      defaultModelId: override === undefined ? null : override,
      userSelectable: channelOverride?.userSelectable ?? agent.userSelectable,
      subagentEligible: channelOverride?.subagentEligible ?? agent.subagentEligible,
    };
  }

  #load(): StoredFile {
    if (!existsSync(this.#filePath)) {
      return {
        ...EMPTY_FILE,
        agents: [],
        builtinDefaultModelIds: {},
        builtinSystemPromptOverrides: {},
        builtinDescriptionOverrides: {},
        builtinChannelOverrides: {},
      };
    }
    try {
      const parsed = JSON.parse(readFileSync(this.#filePath, "utf8")) as Partial<StoredFile>;
      const agents = Array.isArray(parsed.agents)
        ? parsed.agents
            .map((agent) => normalizeStoredAgent(agent))
            .filter((agent): agent is StoredAgentRecord => agent !== null)
        : [];
      return {
        version: FILE_VERSION,
        agents,
        builtinDefaultModelIds: parseBuiltinDefaultModelIds(parsed.builtinDefaultModelIds),
        builtinSystemPromptOverrides: parseBuiltinSystemPromptOverrides(
          parsed.builtinSystemPromptOverrides,
        ),
        builtinDescriptionOverrides: parseBuiltinDescriptionOverrides(
          parsed.builtinDescriptionOverrides,
        ),
        builtinChannelOverrides: parseBuiltinChannelOverrides(parsed.builtinChannelOverrides),
      };
    } catch {
      return {
        ...EMPTY_FILE,
        agents: [],
        builtinDefaultModelIds: {},
        builtinSystemPromptOverrides: {},
        builtinDescriptionOverrides: {},
        builtinChannelOverrides: {},
      };
    }
  }

  #persist(): void {
    mkdirSync(dirname(this.#filePath), { recursive: true });
    writeFileSync(this.#filePath, `${JSON.stringify(this.#data, null, 2)}\n`, "utf8");
  }
}
