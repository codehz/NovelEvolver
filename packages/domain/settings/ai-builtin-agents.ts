import { DEFAULT_AI_SYSTEM_PROMPT } from "./ai-default-system-prompt";
import type { AiAgentConfigPublic, BuiltinAiAgentId } from "./ai-settings";
import {
  BUILTIN_AI_AGENT_ID,
  BUILTIN_BRAINSTORM_ID,
  BUILTIN_CHAPTER_WRITER_ID,
  BUILTIN_CONSISTENCY_REVIEWER_ID,
  BUILTIN_ROLEPLAY_ID,
} from "./ai-settings";
import {
  BRAINSTORM_SYSTEM_PROMPT,
  CHAPTER_WRITER_SYSTEM_PROMPT,
  CONSISTENCY_REVIEWER_SYSTEM_PROMPT,
  ROLEPLAY_SYSTEM_PROMPT,
} from "./ai-specialist-system-prompts";
import {
  AI_SETTINGS_CHAPTER_WRITER_TOOL_NAMES,
  AI_SETTINGS_READ_TOOL_NAMES,
  AI_SETTINGS_TOOL_NAMES,
} from "./ai-tool-catalog";

export const BUILTIN_AI_AGENT_SYSTEM_PROMPT = DEFAULT_AI_SYSTEM_PROMPT;

const ALL_TOOL_NAMES = [...AI_SETTINGS_TOOL_NAMES];

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
    availableToolNames: [...AI_SETTINGS_READ_TOOL_NAMES],
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
    availableToolNames: [...AI_SETTINGS_CHAPTER_WRITER_TOOL_NAMES],
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

export function builtinAiAgents(): AiAgentConfigPublic[] {
  return [
    builtinWritingAssistant(),
    builtinConsistencyReviewer(),
    builtinChapterWriter(),
    builtinBrainstorm(),
    builtinRoleplay(),
  ];
}

export function builtinAiAgentById(id: BuiltinAiAgentId): AiAgentConfigPublic {
  return builtinAiAgents().find((agent) => agent.id === id)!;
}
