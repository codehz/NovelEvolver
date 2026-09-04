import type {
  AiAgentConfigPublic,
  AiAgentConfigWrite,
  AiAgentsSettingsSnapshot,
  BuiltinAiAgentId,
} from "./ai-settings";
import { isBuiltinAiAgentId } from "./ai-settings";
import { isAiSettingsToolName } from "./ai-tool-catalog";
import { normalizeAgentDescription } from "./stores/ai-agents-state";

export const AGENT_EXPORT_FORMAT = "novelevolver.agent" as const;
export const AGENT_EXPORT_VERSION = 1 as const;

export type CustomAgentExport = {
  name: string;
  description: string;
  systemPrompt: string;
  availableToolNames: string[];
  userSelectable: boolean;
  subagentEligible: boolean;
  textOnlyMode: boolean;
};

export type BuiltinOverrideExport = {
  id: BuiltinAiAgentId;
  description: string;
  systemPrompt: string;
  userSelectable: boolean;
  subagentEligible: boolean;
};

export type ParsedAgentExport =
  | { kind: "custom"; agent: CustomAgentExport }
  | { kind: "builtin-override"; agent: BuiltinOverrideExport };

export type AgentExportEnvelope = {
  format: typeof AGENT_EXPORT_FORMAT;
  version: typeof AGENT_EXPORT_VERSION;
} & ParsedAgentExport;

export type AiAgentImportResult = {
  agentId: string;
  snapshot: AiAgentsSettingsSnapshot;
};

export function serializeAgentExport(agent: AiAgentConfigPublic): string {
  const envelope: AgentExportEnvelope = agent.builtin
    ? {
        format: AGENT_EXPORT_FORMAT,
        version: AGENT_EXPORT_VERSION,
        kind: "builtin-override",
        agent: {
          id: assertBuiltinId(agent.id),
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          userSelectable: agent.userSelectable,
          subagentEligible: agent.subagentEligible,
        },
      }
    : {
        format: AGENT_EXPORT_FORMAT,
        version: AGENT_EXPORT_VERSION,
        kind: "custom",
        agent: {
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          availableToolNames: [...agent.availableToolNames],
          userSelectable: agent.userSelectable,
          subagentEligible: agent.subagentEligible,
          textOnlyMode: agent.textOnlyMode,
        },
      };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function parseAgentExport(text: string): ParsedAgentExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(text));
  } catch {
    throw new Error("无法解析 Agent 文件。");
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Agent 文件格式无效。");
  }
  const record = parsed as Partial<AgentExportEnvelope> & { kind?: unknown; agent?: unknown };
  if (record.format !== AGENT_EXPORT_FORMAT) {
    throw new Error("不是 NovelEvolver Agent 文件。");
  }
  if (record.version !== AGENT_EXPORT_VERSION) {
    throw new Error("不支持的 Agent 文件版本。");
  }
  if (record.kind === "custom") {
    return { kind: "custom", agent: parseCustomAgent(record.agent) };
  }
  if (record.kind === "builtin-override") {
    return { kind: "builtin-override", agent: parseBuiltinOverride(record.agent) };
  }
  throw new Error("未知的 Agent 文件类型。");
}

export function toCustomUpsert(agent: CustomAgentExport): AiAgentConfigWrite {
  const name = agent.name.trim();
  const systemPrompt = agent.systemPrompt.trim();
  if (name === "") {
    throw new Error("Agent 名称不能为空。");
  }
  if (systemPrompt === "") {
    throw new Error("系统提示词不能为空。");
  }
  const subagentEligible = agent.subagentEligible;
  return {
    name,
    description: normalizeAgentDescription(agent.description),
    systemPrompt,
    defaultModelId: null,
    availableToolNames: uniqueKnownTools(agent.availableToolNames),
    userSelectable: agent.userSelectable,
    subagentEligible,
    textOnlyMode: normalizeAgentTextOnlyMode(subagentEligible, agent.textOnlyMode),
  };
}

export function toBuiltinUpsert(
  patch: BuiltinOverrideExport,
  current: AiAgentConfigPublic,
): AiAgentConfigWrite {
  const systemPrompt = patch.systemPrompt.trim();
  if (systemPrompt === "") {
    throw new Error("系统提示词不能为空。");
  }
  return {
    id: patch.id,
    name: current.name,
    description: normalizeAgentDescription(patch.description),
    systemPrompt,
    defaultModelId: current.defaultModelId,
    availableToolNames: [...current.availableToolNames],
    userSelectable: patch.userSelectable,
    subagentEligible: patch.subagentEligible,
    textOnlyMode: current.textOnlyMode,
  };
}

export function applyAgentExport(
  text: string,
  findCurrent: (id: string) => AiAgentConfigPublic | null,
): AiAgentConfigWrite {
  const parsed = parseAgentExport(text);
  if (parsed.kind === "custom") {
    return toCustomUpsert(parsed.agent);
  }
  const current = findCurrent(parsed.agent.id);
  if (current == null) {
    throw new Error("内置 Agent 不存在。");
  }
  return toBuiltinUpsert(parsed.agent, current);
}

export function resolveImportedAgentId(
  write: AiAgentConfigWrite,
  snapshot: AiAgentsSettingsSnapshot,
  previousIds: ReadonlySet<string>,
): string {
  if (write.id !== undefined) {
    return write.id;
  }
  const created = snapshot.agents.find((agent) => !previousIds.has(agent.id));
  if (created === undefined) {
    throw new Error("导入失败。");
  }
  return created.id;
}

export function agentExportFileName(name: string): string {
  let stem = "";
  for (const char of name.trim()) {
    const code = char.charCodeAt(0);
    stem += code < 32 || '<>:"/\\|?*'.includes(char) ? "_" : char;
  }
  stem = stem.replace(/\s+/g, " ").slice(0, 80);
  return `${stem === "" ? "agent" : stem}.json`;
}

function assertBuiltinId(id: string): BuiltinAiAgentId {
  if (!isBuiltinAiAgentId(id)) {
    throw new Error("内置 Agent 标识无效。");
  }
  return id;
}

function parseCustomAgent(raw: unknown): CustomAgentExport {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("自定义 Agent 数据无效。");
  }
  const record = raw as Partial<CustomAgentExport>;
  if (typeof record.name !== "string") {
    throw new Error("Agent 名称无效。");
  }
  if (typeof record.systemPrompt !== "string") {
    throw new Error("系统提示词无效。");
  }
  if (typeof record.description !== "string") {
    throw new Error("简介无效。");
  }
  if (!Array.isArray(record.availableToolNames)) {
    throw new Error("工具列表无效。");
  }
  if (typeof record.userSelectable !== "boolean") {
    throw new Error("对话可选标记无效。");
  }
  if (typeof record.subagentEligible !== "boolean") {
    throw new Error("子代理标记无效。");
  }
  if (typeof record.textOnlyMode !== "boolean") {
    throw new Error("纯文本标记无效。");
  }
  const name = record.name.trim();
  const systemPrompt = record.systemPrompt.trim();
  if (name === "") {
    throw new Error("Agent 名称不能为空。");
  }
  if (systemPrompt === "") {
    throw new Error("系统提示词不能为空。");
  }
  return {
    name,
    description: normalizeAgentDescription(record.description),
    systemPrompt,
    availableToolNames: uniqueKnownTools(record.availableToolNames),
    userSelectable: record.userSelectable,
    subagentEligible: record.subagentEligible,
    textOnlyMode: normalizeAgentTextOnlyMode(record.subagentEligible, record.textOnlyMode),
  };
}

function parseBuiltinOverride(raw: unknown): BuiltinOverrideExport {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("内置 Agent 补丁无效。");
  }
  const record = raw as Partial<BuiltinOverrideExport>;
  if (typeof record.id !== "string" || !isBuiltinAiAgentId(record.id)) {
    throw new Error("内置 Agent 标识无效。");
  }
  if (typeof record.systemPrompt !== "string") {
    throw new Error("系统提示词无效。");
  }
  if (typeof record.description !== "string") {
    throw new Error("简介无效。");
  }
  if (typeof record.userSelectable !== "boolean") {
    throw new Error("对话可选标记无效。");
  }
  if (typeof record.subagentEligible !== "boolean") {
    throw new Error("子代理标记无效。");
  }
  const systemPrompt = record.systemPrompt.trim();
  if (systemPrompt === "") {
    throw new Error("系统提示词不能为空。");
  }
  return {
    id: record.id,
    description: normalizeAgentDescription(record.description),
    systemPrompt,
    userSelectable: record.userSelectable,
    subagentEligible: record.subagentEligible,
  };
}

function uniqueKnownTools(names: readonly unknown[]): string[] {
  return [...new Set(names.filter((name): name is string => typeof name === "string"))].filter(
    (name) => isAiSettingsToolName(name),
  );
}

function normalizeAgentTextOnlyMode(subagentEligible: boolean, textOnlyMode: boolean): boolean {
  return subagentEligible && textOnlyMode;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
