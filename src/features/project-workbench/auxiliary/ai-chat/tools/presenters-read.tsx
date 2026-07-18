import { DetailField, DetailList } from "./presenter-detail";
import {
  domainLabel,
  formatStatsObject,
  resultTargetFields,
  resultTextStats,
  targetFields,
  textStats,
} from "./presenter-format";
import { getNumber, getObject, getString, parseObject } from "./presenter-parse";
import type { ToolPresenter } from "./presenter-types";

export const structurePresenter: ToolPresenter = (toolCall) => {
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

export const readPresenter: ToolPresenter = (toolCall) => {
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

export const searchPresenter: ToolPresenter = (toolCall) => {
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

export const changesPresenter: ToolPresenter = (toolCall) => {
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

export const changePresenter: ToolPresenter = (toolCall) => {
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

export const historyPresenter: ToolPresenter = (toolCall) => {
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

export const historyEntryPresenter: ToolPresenter = (toolCall) => {
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
