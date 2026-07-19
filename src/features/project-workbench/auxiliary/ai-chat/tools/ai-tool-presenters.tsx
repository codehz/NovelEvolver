import type { AiChatToolCall } from "#shared/rpc/ai/index";

import { toolActionLabel, toolIcon } from "./presenter-format";
import type { ToolPresentation, ToolPresenter } from "./presenter-types";
import { askUserPresenter, runSubagentPresenter } from "./presenters-interaction";
import {
  changePresenter,
  changesPresenter,
  historyEntryPresenter,
  historyPresenter,
  readPresenter,
  searchPresenter,
  structurePresenter,
} from "./presenters-read";
import {
  createPresenter,
  editPresenter,
  nodeMutationPresenter,
  replacePresenter,
} from "./presenters-write";

const presenters: Partial<Record<string, ToolPresenter>> = {
  ask_user: askUserPresenter,
  run_subagent: runSubagentPresenter,
  read_structure: structurePresenter,
  read_document: readPresenter,
  search_documents: searchPresenter,
  write_document: editPresenter,
  replace_document_text: replacePresenter,
  create_folder: createPresenter,
  create_document: createPresenter,
  move_node: nodeMutationPresenter("移动节点"),
  rename_node: nodeMutationPresenter("重命名节点"),
  delete_node: nodeMutationPresenter("删除节点"),
  read_changes: changesPresenter,
  read_change: changePresenter,
  read_history: historyPresenter,
  read_history_entry: historyEntryPresenter,
};

export type ResolvedToolPresentation = ToolPresentation & { icon: string };

export function presentToolCall(toolCall: AiChatToolCall): ResolvedToolPresentation {
  const presenter = presenters[toolCall.name];
  if (presenter) {
    const presentation = presenter(toolCall);
    return {
      ...presentation,
      icon: presentation.icon ?? toolIcon(toolCall.name),
    };
  }
  return {
    icon: toolIcon(toolCall.name),
    label: toolActionLabel(toolCall.name),
    summary: "已执行",
    detail:
      toolCall.status === "error" ? (
        <p className="text-ctp-subtext0">工具标识：{toolCall.name}</p>
      ) : null,
  };
}
