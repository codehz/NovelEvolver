import type { AiChatToolCall } from "#shared/rpc/ai/index";

import { DetailField, DetailList } from "./presenter-detail";
import {
  domainLabel,
  generationStats,
  kindLabel,
  preview,
  resultTargetFields,
  resultWriteStats,
  targetFields,
  textStats,
  writeIndicator,
} from "./presenter-format";
import { getNumber, getString, parseObject } from "./presenter-parse";
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

const editPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const requestedTarget = targetFields(args);
  const target = resultTargetFields(result);
  const domain = target.domain ?? requestedTarget.domain;
  const id = target.id ?? requestedTarget.id;
  const documentName = target.displayPath || target.label || id || "未知文档";
  const expectedRevision = getNumber(args, "expected_revision");
  const after = getString(args, "new_content");
  const nextRevision = getNumber(result, "revision");
  const writeStats = resultWriteStats(result);
  const afterScale =
    writeStats.stats ??
    (toolCall.status === "pending" ? generationStats(after, toolCall.status) : textStats(after));
  return {
    label: "重写文档",
    summary: `${domainLabel(domain)} · ${documentName}`,
    indicator: writeStats.stats ?? writeIndicator(after, toolCall.status),
    detail: (
      <DetailList>
        {target.displayPath || target.label ? (
          <DetailField label="文档路径">{target.displayPath || target.label}</DetailField>
        ) : null}
        {expectedRevision !== null ? (
          <DetailField label="期望 revision">{expectedRevision}</DetailField>
        ) : null}
        {writeStats.previous !== null ? (
          <DetailField label="原正文规模">{writeStats.previous}</DetailField>
        ) : null}
        <DetailField label="新正文">{afterScale}</DetailField>
        {writeStats.delta !== null ? (
          <DetailField label="变更量">{writeStats.delta}</DetailField>
        ) : null}
        {nextRevision !== null ? (
          <DetailField label="新 revision">{nextRevision}</DetailField>
        ) : null}
        <DetailField label="结果">
          {toolCall.status === "complete" ? "已更新" : "整篇替换"}
        </DetailField>
        <DetailField label="节点 ID">{id ?? "未知"}</DetailField>
      </DetailList>
    ),
  };
};

const replacePresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const requestedTarget = targetFields(args);
  const target = resultTargetFields(result);
  const domain = target.domain ?? requestedTarget.domain;
  const id = target.id ?? requestedTarget.id;
  const documentName = target.displayPath || target.label || id || "未知文档";
  const expected = getString(args, "expected_text");
  const replacement = getString(args, "replacement_text");
  const removing = replacement === "";
  const nextRevision = getNumber(result, "revision");
  const writeStats = resultWriteStats(result);
  return {
    label: removing ? "删除文档片段" : "替换文档片段",
    summary: `${domainLabel(domain)} · ${documentName}`,
    indicator: removing
      ? toolCall.status === "complete"
        ? "已删除"
        : "删除片段"
      : (writeStats.delta ?? writeIndicator(replacement, toolCall.status)),
    detail: (
      <DetailList>
        {target.displayPath || target.label ? (
          <DetailField label="文档路径">{target.displayPath || target.label}</DetailField>
        ) : null}
        <DetailField label="原片段">{textStats(expected)}</DetailField>
        {preview(expected) ? <DetailField label="原文预览">{preview(expected)}</DetailField> : null}
        <DetailField label={removing ? "操作" : "替换片段"}>
          {removing ? "删除匹配片段" : generationStats(replacement, toolCall.status)}
        </DetailField>
        {writeStats.stats !== null ? (
          <DetailField label="写后规模">{writeStats.stats}</DetailField>
        ) : null}
        {writeStats.delta !== null ? (
          <DetailField label="变更量">{writeStats.delta}</DetailField>
        ) : null}
        {!removing && preview(replacement) ? (
          <DetailField label="替换预览">{preview(replacement)}</DetailField>
        ) : null}
        {nextRevision !== null ? (
          <DetailField label="新 revision">{nextRevision}</DetailField>
        ) : null}
        <DetailField label="节点 ID">{id ?? "未知"}</DetailField>
      </DetailList>
    ),
  };
};

const createPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const domain = getString(args, "domain");
  const kind =
    toolCall.name === "create_folder" ? "folder" : domain === "manuscript" ? "chapter" : "file";
  const name = getString(args, "name") ?? "未命名节点";
  const content = getString(args, "content");
  const displayPath = getString(result, "display_path");
  const writeStats = resultWriteStats(result);
  const initialScale =
    writeStats.stats ??
    (toolCall.name === "create_document" ? generationStats(content, toolCall.status) : null);
  return {
    label: `创建${kindLabel(kind)}`,
    summary: `${domainLabel(domain)} · ${displayPath || name}`,
    indicator:
      toolCall.name === "create_document"
        ? (writeStats.stats ?? writeIndicator(content, toolCall.status))
        : undefined,
    detail: (
      <DetailList>
        <DetailField label="名称">{name}</DetailField>
        <DetailField label="类型">{kindLabel(kind)}</DetailField>
        {getNumber(args, "index") !== null ? (
          <DetailField label="插入位置">第 {getNumber(args, "index")! + 1} 位</DetailField>
        ) : null}
        {toolCall.name === "create_document" && initialScale !== null ? (
          <DetailField label="初始正文">{initialScale}</DetailField>
        ) : null}
        {displayPath ? <DetailField label="创建位置">{displayPath}</DetailField> : null}
        {getNumber(result, "revision") !== null ? (
          <DetailField label="新 revision">{getNumber(result, "revision")}</DetailField>
        ) : null}
        <DetailField label="父节点 ID">{getString(args, "parent_id") ?? "未知"}</DetailField>
      </DetailList>
    ),
  };
};

const nodeMutationPresenter =
  (label: string): ToolPresenter =>
  (toolCall) => {
    const args = parseObject(toolCall.argumentsText);
    const result = parseObject(toolCall.resultText);
    const domain = getString(args, "domain");
    const id = getString(args, "id");
    const revision = getNumber(result, "revision");
    const path = getString(result, "display_path");
    const previousPath = getString(result, "previous_display_path");
    const displayName = path ?? previousPath ?? id ?? "未知节点";
    const summary =
      toolCall.name === "move_node" && previousPath && path && previousPath !== path
        ? `${previousPath} → ${path}`
        : toolCall.name === "rename_node" && previousPath && path && previousPath !== path
          ? `${previousPath} → ${path}`
          : displayName;
    return {
      label,
      summary: `${domainLabel(domain)} · ${summary}`,
      detail: (
        <DetailList>
          <DetailField label="内容域">{domainLabel(domain)}</DetailField>
          {previousPath ? <DetailField label="原路径">{previousPath}</DetailField> : null}
          {path ? <DetailField label="当前路径">{path}</DetailField> : null}
          {toolCall.name === "rename_node" ? (
            <DetailField label="新名称">{getString(args, "name") ?? "未知"}</DetailField>
          ) : null}
          {revision !== null ? <DetailField label="新 revision">{revision}</DetailField> : null}
          <DetailField label="节点 ID">{id ?? "未知"}</DetailField>
          {toolCall.name === "move_node" ? (
            <DetailField label="目标父节点 ID">
              {getString(args, "target_parent_id") ?? "未知"}
            </DetailField>
          ) : null}
        </DetailList>
      ),
    };
  };

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
