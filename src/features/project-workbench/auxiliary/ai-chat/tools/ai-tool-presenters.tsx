import { parse as parsePartialJson } from "partial-json";
import type { ReactNode } from "react";

import type { AiChatToolCall } from "#shared/rpc/ai/index";

import { parseAskUserToolArguments } from "./ask-user-prompt";

type JsonObject = Record<string, unknown>;

type ToolPresentation = {
  label: string;
  summary: string;
  indicator?: string;
  detail: ReactNode;
};

type ToolPresenter = (toolCall: AiChatToolCall) => ToolPresentation;

function parseObject(text: string | null): JsonObject | null {
  if (text === null || text.trim() === "") {
    return null;
  }
  try {
    const value: unknown = parsePartialJson(text);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  } catch {
    return null;
  }
}

function getObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function getString(object: JsonObject | null, key: string): string | null {
  const value = object?.[key];
  return typeof value === "string" ? value : null;
}

function getNumber(object: JsonObject | null, key: string): number | null {
  const value = object?.[key];
  return typeof value === "number" ? value : null;
}

function generationStats(text: string | null, status: AiChatToolCall["status"]): string {
  if (text === null) return "等待正文";
  return status === "pending" ? `正在生成 · ${text.length} 字符` : textStats(text);
}

function writeIndicator(text: string | null, status: AiChatToolCall["status"]): string {
  if (text === null) {
    return status === "pending" ? "等待正文" : "0 字符";
  }
  return `${text.length} 字符`;
}

function domainLabel(domain: string | null): string {
  return domain === "manuscript" ? "手稿" : domain === "resource" ? "资源库" : "全部内容";
}

function kindLabel(kind: string | null): string {
  switch (kind) {
    case "chapter":
      return "章节";
    case "file":
      return "文件";
    case "folder":
      return "文件夹";
    default:
      return "节点";
  }
}

function textStats(text: string | null): string {
  if (text === null) {
    return "不可用";
  }
  const lines = text === "" ? 0 : text.split(/\r?\n/u).length;
  return `${text.length} 字符 · ${lines} 行`;
}

function preview(text: string | null): string | null {
  if (!text) {
    return null;
  }
  const compact = text.replace(/\s+/gu, " ").trim();
  return compact.length > 100 ? `${compact.slice(0, 100)}…` : compact;
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-ctp-subtext0">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-app-foreground">{children}</dd>
    </div>
  );
}

function DetailList({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col gap-1.5">{children}</dl>;
}

function targetFields(args: JsonObject | null): { domain: string | null; id: string | null } {
  const target = getObject(args?.target);
  return { domain: getString(target, "domain"), id: getString(target, "id") };
}

function resultTargetFields(result: JsonObject | null): {
  domain: string | null;
  id: string | null;
  label: string | null;
  displayPath: string | null;
} {
  const target = getObject(result?.target);
  return {
    domain: getString(target, "domain"),
    id: getString(target, "id"),
    label: getString(target, "label"),
    displayPath: getString(target, "display_path"),
  };
}

const askUserPresenter: ToolPresenter = (toolCall) => {
  const args = parseAskUserToolArguments(toolCall.argumentsText);
  const question = args?.question ?? "等待补充信息";
  const answer = getString(parseObject(toolCall.resultText), "answer");
  const selectedChoice = args?.choices?.find((choice) => choice.title === answer);
  return {
    label: "询问用户",
    summary: question,
    indicator: toolCall.status === "complete" ? "已选择" : undefined,
    detail: args ? (
      <DetailList>
        <DetailField label="问题">{question}</DetailField>
        {args.context ? <DetailField label="说明">{args.context}</DetailField> : null}
        {args.placeholder ? <DetailField label="输入提示">{args.placeholder}</DetailField> : null}
        {args.choices?.length ? (
          <DetailField label="建议选项">
            <ul className="flex flex-col gap-1">
              {args.choices.map((choice) => (
                <li key={`${choice.title}:${choice.description ?? ""}`}>
                  {choice.title}
                  {choice.description ? (
                    <span className="text-ctp-subtext0"> — {choice.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </DetailField>
        ) : null}
        {answer ? (
          <DetailField label={selectedChoice ? "已选选项" : "用户输入"}>
            {selectedChoice ? (
              <>
                {selectedChoice.title}
                {selectedChoice.description ? (
                  <span className="text-ctp-subtext0"> — {selectedChoice.description}</span>
                ) : null}
              </>
            ) : (
              answer
            )}
          </DetailField>
        ) : null}
      </DetailList>
    ) : null,
  };
};

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
  return {
    label: "读取项目结构",
    summary: `${domainLabel(domain)}${result ? ` · ${total} 个节点` : ""}`,
    detail: (
      <DetailList>
        <DetailField label="范围">{domainLabel(domain)}</DetailField>
        {targetId ? <DetailField label="目标节点">{targetId}</DetailField> : null}
        {result ? <DetailField label="节点数">{total}</DetailField> : null}
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
  const content = getString(result, "content");
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
        {content !== null ? <DetailField label="正文规模">{textStats(content)}</DetailField> : null}
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
  return {
    label: "重写文档",
    summary: `${domainLabel(domain)} · ${documentName}`,
    indicator: writeIndicator(after, toolCall.status),
    detail: (
      <DetailList>
        {target.displayPath || target.label ? (
          <DetailField label="文档路径">{target.displayPath || target.label}</DetailField>
        ) : null}
        {expectedRevision !== null ? (
          <DetailField label="期望 revision">{expectedRevision}</DetailField>
        ) : null}
        <DetailField label="新正文">{generationStats(after, toolCall.status)}</DetailField>
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
  return {
    label: removing ? "删除文档片段" : "替换文档片段",
    summary: `${domainLabel(domain)} · ${documentName}`,
    indicator: removing
      ? toolCall.status === "complete"
        ? "已删除"
        : "删除片段"
      : writeIndicator(replacement, toolCall.status),
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
  return {
    label: `创建${kindLabel(kind)}`,
    summary: `${domainLabel(domain)} · ${displayPath || name}`,
    indicator:
      toolCall.name === "create_document" ? writeIndicator(content, toolCall.status) : undefined,
    detail: (
      <DetailList>
        <DetailField label="名称">{name}</DetailField>
        <DetailField label="类型">{kindLabel(kind)}</DetailField>
        {getNumber(args, "index") !== null ? (
          <DetailField label="插入位置">第 {getNumber(args, "index")! + 1} 位</DetailField>
        ) : null}
        {toolCall.name === "create_document" ? (
          <DetailField label="初始正文">{generationStats(content, toolCall.status)}</DetailField>
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
  return {
    label: "读取文档变更",
    summary: `${domainLabel(target.domain)} · ${path}`,
    detail: (
      <DetailList>
        <DetailField label="文档路径">{path}</DetailField>
        {result ? (
          <DetailField label="原正文">
            {textStats(getString(result, "original_content"))}
          </DetailField>
        ) : null}
        {result ? (
          <DetailField label="当前正文">
            {textStats(getString(result, "current_content"))}
          </DetailField>
        ) : null}
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
  return {
    label: "读取历史版本",
    summary: path
      ? `${domainLabel(getString(result, "domain"))} · ${path}`
      : (getString(args, "entry_id") ?? "未知历史记录"),
    detail: (
      <DetailList>
        {path ? <DetailField label="文档路径">{path}</DetailField> : null}
        {result ? (
          <DetailField label="历史正文">{textStats(getString(result, "content"))}</DetailField>
        ) : null}
        {result ? (
          <DetailField label="此前正文">
            {textStats(getString(result, "before_content"))}
          </DetailField>
        ) : null}
        <DetailField label="历史条目 ID">
          {getString(result, "entry_id") ?? getString(args, "entry_id") ?? "未知"}
        </DetailField>
      </DetailList>
    ),
  };
};

const presenters: Partial<Record<string, ToolPresenter>> = {
  ask_user: askUserPresenter,
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
