import type { AiChatToolCall } from "#shared/rpc/ai/index";

import { DetailField, DetailList } from "./presenter-detail";
import {
  domainLabel,
  formatStatsObject,
  generationStats,
  kindLabel,
  preview,
  resultTargetFields,
  resultTextStats,
  resultWriteStats,
  targetFields,
  textStats,
  writeIndicator,
} from "./presenter-format";
import { getNumber, getObject, getString, parseObject } from "./presenter-parse";
import type { ToolPresentation, ToolPresenter } from "./presenter-types";
import { askUserPresenter, runSubagentPresenter } from "./presenters-interaction";

const structurePresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const target = getObject(args?.target);
  const domain = getString(target, "domain") ?? "all";
  const targetId = getString(target, "id");
  const manuscript = getObject(result?.manuscript);
  const resource = getObject(result?.resource);
  const manuscriptNodes = Array.isArray(manuscript?.nodes) ? manuscript.nodes : [];
  const resourceNodes = Array.isArray(resource?.nodes) ? resource.nodes : [];
  const allNodes = [...manuscriptNodes, ...resourceNodes];
  const total = getNumber(result, "node_count") ?? allNodes.length;
  const collapsed = allNodes.filter((node) => getObject(node)?.expanded === false).length;
  const textCharTotal = allNodes.reduce((sum, node) => {
    const entry = getObject(node);
    const charCount = getNumber(entry, "char_count");
    return charCount === null ? sum : sum + charCount;
  }, 0);
  const textNodeCount = allNodes.filter(
    (node) => getNumber(getObject(node), "char_count") !== null,
  ).length;
  return {
    label: "读取项目结构",
    summary: `${domainLabel(domain)}${result ? ` · ${total} 个节点` : ""}`,
    detail: (
      <DetailList>
        <DetailField label="范围">{domainLabel(domain)}</DetailField>
        {targetId ? <DetailField label="目标节点">{targetId}</DetailField> : null}
        {result ? <DetailField label="节点数">{total}</DetailField> : null}
        {result && textNodeCount > 0 ? (
          <DetailField label="可见正文">
            {textNodeCount} 个节点 · {textCharTotal} 字符
          </DetailField>
        ) : null}
        {result ? (
          <DetailField label="节点预算">{getNumber(result, "budget") ?? "未知"}</DetailField>
        ) : null}
        {result ? <DetailField label="待展开目录">{collapsed}</DetailField> : null}
        {manuscript ? (
          <DetailField label="手稿根节点">{getString(manuscript, "root_id") ?? "未知"}</DetailField>
        ) : null}
        {resource ? (
          <DetailField label="资源根节点">{getString(resource, "root_id") ?? "未知"}</DetailField>
        ) : null}
      </DetailList>
    ),
  };
};

const readPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const requestedTarget = targetFields(args);
  const result = toolCall.status === "complete" ? parseObject(toolCall.resultText) : null;
  const resultTarget = getObject(result?.target);
  const domain = getString(resultTarget, "domain") ?? requestedTarget.domain;
  const id = getString(resultTarget, "id") ?? requestedTarget.id;
  const label = getString(resultTarget, "label");
  const displayPath = getString(resultTarget, "display_path");
  const documentName = displayPath || label || id || "未知文档";
  const contentScale = resultTextStats(result);
  const revision = getNumber(result, "revision");
  return {
    label: "读取文档",
    summary: `${domainLabel(domain)} · ${documentName}`,
    detail: (
      <DetailList>
        <DetailField label="内容域">{domainLabel(domain)}</DetailField>
        {displayPath || label ? (
          <DetailField label="文档路径">{displayPath || label}</DetailField>
        ) : null}
        {contentScale !== null ? <DetailField label="正文规模">{contentScale}</DetailField> : null}
        {revision !== null ? <DetailField label="Revision">{revision}</DetailField> : null}
        <DetailField label="节点 ID">{id ?? "未知"}</DetailField>
      </DetailList>
    ),
  };
};

const searchPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const query = getString(args, "query") ?? "未知关键词";
  const scope = getString(args, "scope");
  const isRegex =
    typeof args?.is_regex === "boolean"
      ? args.is_regex
      : typeof result?.is_regex === "boolean"
        ? result.is_regex
        : false;
  const manuscriptHits = Array.isArray(result?.manuscript_hits) ? result.manuscript_hits : [];
  const resourceHits = Array.isArray(result?.resource_hits) ? result.resource_hits : [];
  const hits = [...manuscriptHits, ...resourceHits];
  return {
    label: "搜索项目",
    summary: `“${query}”${isRegex ? " · 正则" : ""}${result ? ` · ${hits.length} 处命中` : ""}`,
    detail: (
      <DetailList>
        <DetailField label="关键词">{query}</DetailField>
        <DetailField label="匹配方式">{isRegex ? "正则表达式" : "字面匹配"}</DetailField>
        <DetailField label="范围">{domainLabel(scope)}</DetailField>
        {getNumber(args, "max_results") !== null ? (
          <DetailField label="结果上限">每个内容域 {getNumber(args, "max_results")}</DetailField>
        ) : null}
        {result ? <DetailField label="命中数">{hits.length}</DetailField> : null}
        {hits.length > 0 ? (
          <DetailField label="命中位置">
            <ul className="flex flex-col gap-1">
              {hits.slice(0, 8).map((hit, index) => {
                const entry = getObject(hit);
                const path = getString(entry, "path") ?? getString(entry, "label") ?? "未知文档";
                const line = getNumber(entry, "line");
                return <li key={`${path}:${line ?? index}`}>{line ? `${path}:${line}` : path}</li>;
              })}
              {hits.length > 8 ? (
                <li className="text-ctp-subtext0">另有 {hits.length - 8} 处</li>
              ) : null}
            </ul>
          </DetailField>
        ) : null}
      </DetailList>
    ),
  };
};

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

const changesPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const domain = getString(result, "domain") ?? getString(args, "domain");
  const changes = [
    ...(Array.isArray(result?.manuscript_changes) ? result.manuscript_changes : []),
    ...(Array.isArray(result?.resource_changes) ? result.resource_changes : []),
  ];
  return {
    label: "读取工作区变更",
    summary: `${domainLabel(domain)}${result ? ` · ${changes.length} 项变更` : ""}`,
    detail: (
      <DetailList>
        <DetailField label="范围">{domainLabel(domain)}</DetailField>
        {result ? <DetailField label="变更数">{changes.length}</DetailField> : null}
        {changes.length > 0 ? (
          <DetailField label="变更位置">
            <ul className="flex flex-col gap-1">
              {changes.slice(0, 8).map((change, index) => {
                const entry = getObject(change);
                const path =
                  getString(entry, "display_path") ?? getString(entry, "label") ?? "未知节点";
                const previousPath = getString(entry, "previous_path");
                return (
                  <li key={`${path}:${index}`}>
                    {previousPath ? `${previousPath} → ${path}` : path}
                  </li>
                );
              })}
              {changes.length > 8 ? (
                <li className="text-ctp-subtext0">另有 {changes.length - 8} 项</li>
              ) : null}
            </ul>
          </DetailField>
        ) : null}
      </DetailList>
    ),
  };
};

const changePresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const target = targetFields(args);
  const path =
    getString(result, "display_path") ?? getString(result, "label") ?? target.id ?? "未知文档";
  const originalScale =
    formatStatsObject(getObject(result?.original_stats)) ??
    (result ? textStats(getString(result, "original_content")) : null);
  const currentScale =
    formatStatsObject(getObject(result?.current_stats)) ??
    (result ? textStats(getString(result, "current_content")) : null);
  return {
    label: "读取文档变更",
    summary: `${domainLabel(target.domain)} · ${path}`,
    detail: (
      <DetailList>
        <DetailField label="文档路径">{path}</DetailField>
        {originalScale !== null ? <DetailField label="原正文">{originalScale}</DetailField> : null}
        {currentScale !== null ? <DetailField label="当前正文">{currentScale}</DetailField> : null}
        <DetailField label="节点 ID">{target.id ?? "未知"}</DetailField>
      </DetailList>
    ),
  };
};

const historyPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const requestedDomain = getString(args, "domain");
  const requestedId = getString(args, "id");
  const target = resultTargetFields(result);
  const entries = Array.isArray(result?.entries) ? result.entries : [];
  const path = target.displayPath || target.label || requestedId || "未知文档";
  return {
    label: "读取文档历史",
    summary: `${domainLabel(target.domain ?? requestedDomain)} · ${path}${result ? ` · ${entries.length} 条` : ""}`,
    detail: (
      <DetailList>
        {target.displayPath || target.label ? (
          <DetailField label="文档路径">{path}</DetailField>
        ) : null}
        {result ? <DetailField label="历史条目">{entries.length}</DetailField> : null}
        <DetailField label="节点 ID">{target.id ?? requestedId ?? "未知"}</DetailField>
      </DetailList>
    ),
  };
};

const historyEntryPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const path = getString(result, "display_path") ?? getString(result, "label");
  const contentScale =
    formatStatsObject(getObject(result?.content_stats)) ??
    (result ? textStats(getString(result, "content")) : null);
  const beforeScale =
    formatStatsObject(getObject(result?.before_content_stats)) ??
    (result ? textStats(getString(result, "before_content")) : null);
  return {
    label: "读取历史版本",
    summary: path
      ? `${domainLabel(getString(result, "domain"))} · ${path}`
      : (getString(args, "entry_id") ?? "未知历史记录"),
    detail: (
      <DetailList>
        {path ? <DetailField label="文档路径">{path}</DetailField> : null}
        {contentScale !== null ? <DetailField label="历史正文">{contentScale}</DetailField> : null}
        {beforeScale !== null ? <DetailField label="此前正文">{beforeScale}</DetailField> : null}
        <DetailField label="历史条目 ID">
          {getString(result, "entry_id") ?? getString(args, "entry_id") ?? "未知"}
        </DetailField>
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
