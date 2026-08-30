import type { ToolDefinition, ToolResultItem } from "@codehz/ai";

import type { AiChatInteractionAnswer, AiChatOpenInteraction } from "#shared/rpc/ai/index";

import { askUserSpec } from "./specs/ask-user";
import { createDocumentSpec } from "./specs/create-document";
import { createFolderSpec } from "./specs/create-folder";
import { deleteNodeSpec } from "./specs/delete-node";
import { moveNodeSpec } from "./specs/move-node";
import { readChangeSpec } from "./specs/read-change";
import { readChangesSpec } from "./specs/read-changes";
import { readDocumentSpec } from "./specs/read-document";
import { readHistorySpec } from "./specs/read-history";
import { readHistoryEntrySpec } from "./specs/read-history-entry";
import { readStructureSpec } from "./specs/read-structure";
import { renameNodeSpec } from "./specs/rename-node";
import { replaceDocumentTextSpec } from "./specs/replace-document-text";
import { runSubagentSpec } from "./specs/run-subagent";
import { searchDocumentsSpec } from "./specs/search-documents";
import { writeDocumentSpec } from "./specs/write-document";
import type { PendingUserInputSerializable, ToolSpec, UserInputContribution } from "./types";

/** 全部 tool 规格；加 tool = 新增 specs/* + 在此挂一行。 */
export const TOOL_SPECS = [
  askUserSpec,
  runSubagentSpec,
  readStructureSpec,
  readDocumentSpec,
  searchDocumentsSpec,
  writeDocumentSpec,
  replaceDocumentTextSpec,
  createFolderSpec,
  createDocumentSpec,
  moveNodeSpec,
  renameNodeSpec,
  deleteNodeSpec,
  readChangesSpec,
  readChangeSpec,
  readHistorySpec,
  readHistoryEntrySpec,
] as const satisfies readonly ToolSpec[];

export type AI_TOOL_NAMES = (typeof TOOL_SPECS)[number]["name"];

export const AI_TOOL_NAMES: { [key in AI_TOOL_NAMES]: key } = Object.fromEntries(
  TOOL_SPECS.map((spec) => [spec.name, spec.name]),
) as { [key in AI_TOOL_NAMES]: key };

export const AI_TOOLS_MAP: { [key in AI_TOOL_NAMES]: Omit<ToolDefinition, "name"> } =
  Object.fromEntries(TOOL_SPECS.map((spec) => [spec.name, spec.definition])) as {
    [key in AI_TOOL_NAMES]: Omit<ToolDefinition, "name">;
  };

export const AI_TOOLS: ToolDefinition[] = TOOL_SPECS.map((spec) => ({
  name: spec.name,
  ...spec.definition,
}));

export const AI_TOOL_CATALOG = TOOL_SPECS.map((spec) => ({
  name: spec.name,
  description: spec.definition.description,
}));

export const TOOL_SPEC_BY_NAME: ReadonlyMap<string, ToolSpec> = new Map(
  TOOL_SPECS.map((spec) => [spec.name, spec]),
);

const USER_INPUT_CONTRIBUTIONS: ReadonlyMap<string, UserInputContribution> = new Map(
  TOOL_SPECS.flatMap((spec) =>
    spec.userInput === undefined ? [] : [[spec.name, spec.userInput] as const],
  ),
);

export function selectAiTools(names: readonly string[]): ToolDefinition[] {
  const allowed = new Set(names);
  return AI_TOOLS.filter((tool) => allowed.has(tool.name));
}

function getUserInputContribution(toolName: string): UserInputContribution {
  const contribution = USER_INPUT_CONTRIBUTIONS.get(toolName);
  if (!contribution) {
    throw new Error(`未知的用户输入工具贡献: ${toolName}`);
  }
  return contribution;
}

export function createOpenInteractionFromSerializable(
  id: string,
  serializable: PendingUserInputSerializable,
): AiChatOpenInteraction {
  return getUserInputContribution(serializable.toolName).createOpenInteraction(id, serializable);
}

export function resolveUserInputAnswer(
  toolName: string,
  id: string,
  answer: AiChatInteractionAnswer,
): ToolResultItem | null {
  return getUserInputContribution(toolName).resolveAnswer(id, answer);
}

export function resolveUserInputCancel(toolName: string, id: string): ToolResultItem {
  return getUserInputContribution(toolName).resolveCancel(id);
}
