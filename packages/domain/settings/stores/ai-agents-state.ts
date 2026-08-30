import { builtinAiAgentById, builtinAiAgents } from "../ai-builtin-agents";
import type {
  AiAgentConfigPublic,
  AiAgentConfigWrite,
  AiAgentsSettingsSnapshot,
  BuiltinAiAgentId,
} from "../ai-settings";
import {
  AI_AGENT_DESCRIPTION_MAX_LENGTH,
  BUILTIN_AI_AGENT_ID,
  BUILTIN_AI_AGENT_IDS,
  isBuiltinAiAgentId,
} from "../ai-settings";
import { AI_TOOL_CATALOG, isAiSettingsToolName } from "../ai-tool-catalog";
import type { CreateId } from "../create-id";

export const AI_AGENTS_STATE_VERSION = 2 as const;

export type StoredAgentRecord = Omit<
  AiAgentConfigPublic,
  "builtin" | "defaultSystemPrompt" | "defaultDescription"
>;

export type BuiltinDefaultModelIds = Partial<Record<BuiltinAiAgentId, string | null>>;
export type BuiltinSystemPromptOverrides = Partial<Record<BuiltinAiAgentId, string>>;
export type BuiltinDescriptionOverrides = Partial<Record<BuiltinAiAgentId, string>>;
export type BuiltinChannelOverride = {
  userSelectable?: boolean;
  subagentEligible?: boolean;
};
export type BuiltinChannelOverrides = Partial<Record<BuiltinAiAgentId, BuiltinChannelOverride>>;

export type AiAgentsStateData = {
  agents: StoredAgentRecord[];
  builtinDefaultModelIds: BuiltinDefaultModelIds;
  builtinSystemPromptOverrides: BuiltinSystemPromptOverrides;
  builtinDescriptionOverrides: BuiltinDescriptionOverrides;
  builtinChannelOverrides: BuiltinChannelOverrides;
};

export const EMPTY_AI_AGENTS_STATE: AiAgentsStateData = {
  agents: [],
  builtinDefaultModelIds: {},
  builtinSystemPromptOverrides: {},
  builtinDescriptionOverrides: {},
  builtinChannelOverrides: {},
};

export type AiAgentRuntimeConfig = AiAgentConfigPublic;

type AiAgentsStateOptions = {
  createId: CreateId;
  knownModelIds: () => readonly string[];
  data?: AiAgentsStateData;
};

export class AiAgentsState {
  readonly #createId: CreateId;
  readonly #knownModelIds: () => readonly string[];
  #data: AiAgentsStateData;

  constructor(options: AiAgentsStateOptions) {
    this.#createId = options.createId;
    this.#knownModelIds = options.knownModelIds;
    this.#data = options.data ?? cloneEmptyAgentsState();
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

  serialize(): AiAgentsStateData {
    return {
      agents: this.#data.agents.map((agent) => ({ ...agent })),
      builtinDefaultModelIds: { ...this.#data.builtinDefaultModelIds },
      builtinSystemPromptOverrides: { ...this.#data.builtinSystemPromptOverrides },
      builtinDescriptionOverrides: { ...this.#data.builtinDescriptionOverrides },
      builtinChannelOverrides: { ...this.#data.builtinChannelOverrides },
    };
  }

  getRuntimeConfig(id: string): AiAgentRuntimeConfig {
    return (
      this.findRuntimeConfig(id) ?? this.#mergedBuiltin(builtinAiAgentById(BUILTIN_AI_AGENT_ID))
    );
  }

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
    if (availableToolNames.some((toolName) => !isAiSettingsToolName(toolName))) {
      throw new Error("包含未知工具。");
    }

    const record: StoredAgentRecord = {
      id: input.id ?? this.#createId(),
      name,
      description: normalizeAgentDescription(input.description),
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

    const baseline = builtinAiAgentById(id);
    if (systemPrompt === baseline.systemPrompt) {
      const { [id]: _removed, ...rest } = this.#data.builtinSystemPromptOverrides;
      this.#data.builtinSystemPromptOverrides = rest;
    } else {
      this.#data.builtinSystemPromptOverrides = {
        ...this.#data.builtinSystemPromptOverrides,
        [id]: systemPrompt,
      };
    }

    const description = normalizeAgentDescription(input.description);
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

    return this.getSnapshot();
  }

  #assertDefaultModelId(defaultModelId: string | null): void {
    if (defaultModelId !== null && !this.#knownModelIds().includes(defaultModelId)) {
      throw new Error("默认模型不存在。");
    }
  }

  #mergedBuiltinAgents(): AiAgentConfigPublic[] {
    return builtinAiAgents().map((agent) => this.#mergedBuiltin(agent));
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
}

export function parseAiAgentsState(value: unknown): AiAgentsStateData {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return cloneEmptyAgentsState();
  }
  const parsed = value as Partial<AiAgentsStateData>;
  const agents = Array.isArray(parsed.agents)
    ? parsed.agents
        .map((agent) => normalizeStoredAgent(agent))
        .filter((agent): agent is StoredAgentRecord => agent !== null)
    : [];
  return {
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
}

export function normalizeAgentDescription(value: string): string {
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

function cloneEmptyAgentsState(): AiAgentsStateData {
  return {
    agents: [],
    builtinDefaultModelIds: {},
    builtinSystemPromptOverrides: {},
    builtinDescriptionOverrides: {},
    builtinChannelOverrides: {},
  };
}

function parseBooleanFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeAgentTextOnlyMode(subagentEligible: boolean, textOnlyMode: boolean): boolean {
  return subagentEligible && textOnlyMode;
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
    typeof record.description === "string" ? normalizeAgentDescription(record.description) : "";

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
      result[id] = normalizeAgentDescription(value);
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
