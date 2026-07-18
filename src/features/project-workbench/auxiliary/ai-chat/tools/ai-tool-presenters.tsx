import type { AiChatToolCall } from "#shared/rpc/ai/index";

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

export function presentToolCall(toolCall: AiChatToolCall): ToolPresentation {
  const presenter = presenters[toolCall.name];
  if (presenter) {
    return presenter(toolCall);
  }
  return {
    label: "执行工具",
    summary: toolCall.name,
    detail: <p className="text-ctp-subtext0">此工具暂未提供专属详情视图。原始参数和结果已隐藏。</p>,
  };
}
