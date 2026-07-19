import { DetailField, DetailList, ErrorTechnicalFields, SnippetPreview } from "./presenter-detail";
import {
  domainLabel,
  displayTargetName,
  generationStats,
  kindLabel,
  preview,
  resultTargetFields,
  resultWriteStats,
  targetFields,
  textStats,
  toolActionLabel,
  toolIcon,
  writeIndicator,
} from "./presenter-format";
import { getNumber, getString, parseObject } from "./presenter-parse";
import type { TechnicalField, ToolPresenter } from "./presenter-types";

function techFields(fields: Array<TechnicalField | null | false | undefined>): TechnicalField[] {
  return fields.filter((field): field is TechnicalField => Boolean(field));
}

function maybeErrorTech(status: string, fields: Array<TechnicalField | null | false | undefined>) {
  if (status !== "error") {
    return null;
  }
  const list = techFields(fields);
  return list.length > 0 ? <ErrorTechnicalFields fields={list} /> : null;
}

export const editPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const requestedTarget = targetFields(args);
  const target = resultTargetFields(result);
  const domain = target.domain ?? requestedTarget.domain;
  const id = target.id ?? requestedTarget.id;
  const documentName = displayTargetName({
    displayPath: target.displayPath,
    label: target.label,
    id,
    fallback: "未知文档",
  });
  const expectedRevision = getNumber(args, "expected_revision");
  const after = getString(args, "new_content");
  const nextRevision = getNumber(result, "revision");
  const writeStats = resultWriteStats(result);
  const afterScale =
    writeStats.stats ??
    (toolCall.status === "pending" ? generationStats(after, toolCall.status) : textStats(after));
  const hasFacts =
    writeStats.previous !== null || writeStats.delta !== null || afterScale !== "不可用";
  const isError = toolCall.status === "error";

  return {
    icon: toolIcon("write_document"),
    label: toolActionLabel("write_document"),
    summary: `${domainLabel(domain)} · ${documentName}`,
    indicator: writeStats.delta ?? writeStats.stats ?? writeIndicator(after, toolCall.status),
    detail:
      hasFacts || isError ? (
        <>
          {hasFacts ? (
            <DetailList>
              {writeStats.previous !== null ? (
                <DetailField label="原正文">{writeStats.previous}</DetailField>
              ) : null}
              <DetailField label="新正文">{afterScale}</DetailField>
              {writeStats.delta !== null ? (
                <DetailField label="变更量">{writeStats.delta}</DetailField>
              ) : null}
            </DetailList>
          ) : null}
          {maybeErrorTech(toolCall.status, [
            id ? { label: "节点 ID", value: id } : null,
            expectedRevision !== null
              ? { label: "期望 revision", value: String(expectedRevision) }
              : null,
            nextRevision !== null ? { label: "新 revision", value: String(nextRevision) } : null,
          ])}
        </>
      ) : null,
  };
};

export const replacePresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const requestedTarget = targetFields(args);
  const target = resultTargetFields(result);
  const domain = target.domain ?? requestedTarget.domain;
  const id = target.id ?? requestedTarget.id;
  const documentName = displayTargetName({
    displayPath: target.displayPath,
    label: target.label,
    id,
    fallback: "未知文档",
  });
  const expected = getString(args, "expected_text");
  const replacement = getString(args, "replacement_text");
  const removing = replacement === "";
  const nextRevision = getNumber(result, "revision");
  const writeStats = resultWriteStats(result);
  const expectedPreview = preview(expected);
  const replacementPreview = !removing ? preview(replacement) : null;
  const hasFacts =
    expected != null ||
    writeStats.stats !== null ||
    writeStats.delta !== null ||
    expectedPreview != null ||
    replacementPreview != null;
  const isError = toolCall.status === "error";

  return {
    icon: toolIcon("replace_document_text"),
    label: removing ? "删除片段" : toolActionLabel("replace_document_text"),
    summary: `${domainLabel(domain)} · ${documentName}`,
    indicator: removing
      ? toolCall.status === "complete"
        ? "已删除"
        : "删除片段"
      : (writeStats.delta ?? writeIndicator(replacement, toolCall.status)),
    detail:
      hasFacts || isError ? (
        <>
          {hasFacts ? (
            <div className="flex flex-col gap-1.5">
              <DetailList>
                <DetailField label="原片段">{textStats(expected)}</DetailField>
                {!removing ? (
                  <DetailField label="替换片段">
                    {generationStats(replacement, toolCall.status)}
                  </DetailField>
                ) : (
                  <DetailField label="操作">删除匹配片段</DetailField>
                )}
                {writeStats.stats !== null ? (
                  <DetailField label="写后规模">{writeStats.stats}</DetailField>
                ) : null}
                {writeStats.delta !== null ? (
                  <DetailField label="变更量">{writeStats.delta}</DetailField>
                ) : null}
              </DetailList>
              {expectedPreview ? <SnippetPreview label="原文预览" text={expectedPreview} /> : null}
              {replacementPreview ? (
                <SnippetPreview label="替换预览" text={replacementPreview} />
              ) : null}
            </div>
          ) : null}
          {maybeErrorTech(toolCall.status, [
            id ? { label: "节点 ID", value: id } : null,
            nextRevision !== null ? { label: "新 revision", value: String(nextRevision) } : null,
          ])}
        </>
      ) : null,
  };
};

export const createPresenter: ToolPresenter = (toolCall) => {
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
  const revision = getNumber(result, "revision");
  const parentId = getString(args, "parent_id");
  const isError = toolCall.status === "error";
  const label =
    toolCall.name === "create_folder" ? toolActionLabel("create_folder") : `创建${kindLabel(kind)}`;

  return {
    icon: toolIcon(toolCall.name),
    label,
    summary: `${domainLabel(domain)} · ${displayPath || name}`,
    indicator:
      toolCall.name === "create_document"
        ? (writeStats.stats ?? writeIndicator(content, toolCall.status))
        : toolCall.status === "complete"
          ? "已创建"
          : undefined,
    detail: isError ? (
      maybeErrorTech(toolCall.status, [
        parentId ? { label: "父节点 ID", value: parentId } : null,
        revision !== null ? { label: "Revision", value: String(revision) } : null,
        getNumber(args, "index") !== null
          ? { label: "插入位", value: String(getNumber(args, "index")! + 1) }
          : null,
        initialScale ? { label: "初始正文", value: initialScale } : null,
      ])
    ) : toolCall.name === "create_document" &&
      initialScale !== null &&
      toolCall.status !== "complete" ? (
      <DetailList>
        <DetailField label="初始正文">{initialScale}</DetailField>
      </DetailList>
    ) : null,
  };
};

export const nodeMutationPresenter =
  (label: string): ToolPresenter =>
  (toolCall) => {
    const args = parseObject(toolCall.argumentsText);
    const result = parseObject(toolCall.resultText);
    const domain = getString(args, "domain");
    const id = getString(args, "id");
    const revision = getNumber(result, "revision");
    const path = getString(result, "display_path");
    const previousPath = getString(result, "previous_display_path");
    const displayName = path ?? previousPath ?? "未知节点";
    const summary =
      (toolCall.name === "move_node" || toolCall.name === "rename_node") &&
      previousPath &&
      path &&
      previousPath !== path
        ? `${previousPath} → ${path}`
        : displayName;
    const isError = toolCall.status === "error";
    const newName = getString(args, "name");
    const targetParentId = getString(args, "target_parent_id");

    return {
      icon: toolIcon(toolCall.name),
      label,
      summary: `${domainLabel(domain)} · ${summary}`,
      indicator:
        toolCall.status === "complete"
          ? toolCall.name === "delete_node"
            ? "已删除"
            : toolCall.name === "rename_node"
              ? "已重命名"
              : toolCall.name === "move_node"
                ? "已移动"
                : "完成"
          : undefined,
      detail: isError
        ? maybeErrorTech(toolCall.status, [
            id ? { label: "节点 ID", value: id } : null,
            targetParentId ? { label: "目标父节点", value: targetParentId } : null,
            newName ? { label: "新名称", value: newName } : null,
            revision !== null ? { label: "Revision", value: String(revision) } : null,
          ])
        : null,
    };
  };
