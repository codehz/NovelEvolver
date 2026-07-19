import {
  ActivityPathList,
  DetailField,
  DetailList,
  maybeErrorTechnicalFields,
} from "./presenter-detail";
import {
  domainLabel,
  displayTargetName,
  formatStatsObject,
  resultTargetFields,
  resultTextStats,
  targetFields,
  textStats,
  toolActionLabel,
  toolIcon,
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
  const hasResult = result != null;
  const detail =
    hasResult || toolCall.status === "error" ? (
      <>
        {hasResult ? (
          <DetailList>
            <DetailField label="范围">{domainLabel(domain)}</DetailField>
            <DetailField label="节点数">{total}</DetailField>
            {textNodeCount > 0 ? (
              <DetailField label="可见正文">
                {textNodeCount} 个节点 · {textCharTotal} 字符
              </DetailField>
            ) : null}
            {collapsed > 0 ? <DetailField label="待展开目录">{collapsed}</DetailField> : null}
          </DetailList>
        ) : null}
        {maybeErrorTechnicalFields(toolCall.status, [
          targetId ? { label: "节点 ID", value: targetId } : null,
          getNumber(result, "budget") !== null
            ? { label: "预算", value: String(getNumber(result, "budget")) }
            : null,
        ])}
      </>
    ) : null;

  return {
    icon: toolIcon("read_structure"),
    label: toolActionLabel("read_structure"),
    summary: domainLabel(domain),
    indicator: hasResult ? `${total} 个节点` : undefined,
    detail,
  };
};

export const readPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const requestedTarget = targetFields(args);
  const result =
    toolCall.status === "complete" || toolCall.status === "error"
      ? parseObject(toolCall.resultText)
      : null;
  const resultTarget = getObject(result?.target);
  const domain = getString(resultTarget, "domain") ?? requestedTarget.domain;
  const id = getString(resultTarget, "id") ?? requestedTarget.id;
  const label = getString(resultTarget, "label");
  const displayPath = getString(resultTarget, "display_path");
  const documentName = displayTargetName({
    displayPath,
    label,
    id,
    fallback: "未知文档",
  });
  const contentScale = resultTextStats(result);
  const revision = getNumber(result, "revision");
  const isError = toolCall.status === "error";

  return {
    icon: toolIcon("read_document"),
    label: toolActionLabel("read_document"),
    summary: `${domainLabel(domain)} · ${documentName}`,
    indicator: contentScale ?? undefined,
    detail: isError
      ? maybeErrorTechnicalFields(toolCall.status, [
          id ? { label: "节点 ID", value: id } : null,
          revision !== null ? { label: "Revision", value: String(revision) } : null,
        ])
      : null,
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
  const pathItems = hits.map((hit, index) => {
    const entry = getObject(hit);
    const path = getString(entry, "path") ?? getString(entry, "label") ?? "未知文档";
    const line = getNumber(entry, "line");
    return line ? `${path}:${line}` : path || `命中 ${index + 1}`;
  });
  const hasResult = result != null;

  return {
    icon: toolIcon("search_documents"),
    label: toolActionLabel("search_documents"),
    summary: `“${query}”${isRegex ? " · 正则" : ""}`,
    indicator: hasResult ? `${hits.length} 处命中` : undefined,
    detail:
      hasResult || toolCall.status === "error" ? (
        <>
          {hasResult ? (
            <DetailList>
              <DetailField label="范围">{domainLabel(scope)}</DetailField>
              {pathItems.length > 0 ? (
                <DetailField label="命中">
                  <ActivityPathList items={pathItems} emptyLabel="无命中" />
                </DetailField>
              ) : (
                <DetailField label="命中">无</DetailField>
              )}
            </DetailList>
          ) : null}
          {maybeErrorTechnicalFields(toolCall.status, [
            { label: "关键词", value: query },
            getNumber(args, "max_results") !== null
              ? { label: "上限", value: String(getNumber(args, "max_results")) }
              : null,
          ])}
        </>
      ) : null,
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
  const pathItems = changes.map((change, index) => {
    const entry = getObject(change);
    const path = getString(entry, "display_path") ?? getString(entry, "label") ?? "未知节点";
    const previousPath = getString(entry, "previous_path");
    return previousPath ? `${previousPath} → ${path}` : path || `变更 ${index + 1}`;
  });
  const hasResult = result != null;

  return {
    icon: toolIcon("read_changes"),
    label: toolActionLabel("read_changes"),
    summary: domainLabel(domain),
    indicator: hasResult ? `${changes.length} 项` : undefined,
    detail:
      hasResult || toolCall.status === "error" ? (
        <>
          {hasResult ? (
            pathItems.length > 0 ? (
              <ActivityPathList items={pathItems} emptyLabel="无变更" />
            ) : (
              <p className="text-ctp-subtext0">无变更</p>
            )
          ) : null}
          {maybeErrorTechnicalFields(toolCall.status, [
            domain ? { label: "范围", value: domain } : null,
          ])}
        </>
      ) : null,
  };
};

export const changePresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const target = targetFields(args);
  const path = displayTargetName({
    displayPath: getString(result, "display_path"),
    label: getString(result, "label"),
    id: target.id,
    fallback: "未知文档",
  });
  const originalScale =
    formatStatsObject(getObject(result?.original_stats)) ??
    (result ? textStats(getString(result, "original_content")) : null);
  const currentScale =
    formatStatsObject(getObject(result?.current_stats)) ??
    (result ? textStats(getString(result, "current_content")) : null);
  const hasScales = originalScale !== null || currentScale !== null;
  const isError = toolCall.status === "error";

  return {
    icon: toolIcon("read_change"),
    label: toolActionLabel("read_change"),
    summary: `${domainLabel(target.domain)} · ${path}`,
    indicator: currentScale ?? originalScale ?? undefined,
    detail:
      hasScales || isError ? (
        <>
          {hasScales ? (
            <DetailList>
              {originalScale !== null ? (
                <DetailField label="原正文">{originalScale}</DetailField>
              ) : null}
              {currentScale !== null ? (
                <DetailField label="当前正文">{currentScale}</DetailField>
              ) : null}
            </DetailList>
          ) : null}
          {maybeErrorTechnicalFields(toolCall.status, [
            target.id ? { label: "节点 ID", value: target.id } : null,
          ])}
        </>
      ) : null,
  };
};

export const historyPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const requestedDomain = getString(args, "domain");
  const requestedId = getString(args, "id");
  const target = resultTargetFields(result);
  const entries = Array.isArray(result?.entries) ? result.entries : [];
  const path = displayTargetName({
    displayPath: target.displayPath,
    label: target.label,
    id: requestedId,
    fallback: "未知文档",
  });
  const hasResult = result != null;
  const isError = toolCall.status === "error";

  return {
    icon: toolIcon("read_history"),
    label: toolActionLabel("read_history"),
    summary: `${domainLabel(target.domain ?? requestedDomain)} · ${path}`,
    indicator: hasResult ? `${entries.length} 条` : undefined,
    detail: isError
      ? maybeErrorTechnicalFields(toolCall.status, [
          (target.id ?? requestedId)
            ? { label: "节点 ID", value: target.id ?? requestedId ?? "" }
            : null,
        ])
      : null,
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
  const entryId = getString(result, "entry_id") ?? getString(args, "entry_id");
  const summary = path
    ? `${domainLabel(getString(result, "domain"))} · ${path}`
    : entryId
      ? "历史版本"
      : "未知历史记录";
  const hasScales = contentScale !== null || beforeScale !== null;
  const isError = toolCall.status === "error";

  return {
    icon: toolIcon("read_history_entry"),
    label: toolActionLabel("read_history_entry"),
    summary,
    indicator: contentScale ?? undefined,
    detail:
      hasScales || isError ? (
        <>
          {hasScales ? (
            <DetailList>
              {contentScale !== null ? (
                <DetailField label="历史正文">{contentScale}</DetailField>
              ) : null}
              {beforeScale !== null ? (
                <DetailField label="此前正文">{beforeScale}</DetailField>
              ) : null}
            </DetailList>
          ) : null}
          {maybeErrorTechnicalFields(toolCall.status, [
            entryId ? { label: "条目 ID", value: entryId } : null,
          ])}
        </>
      ) : null,
  };
};
