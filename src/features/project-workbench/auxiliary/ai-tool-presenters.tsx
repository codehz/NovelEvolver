import type { ReactNode } from "react";

import type { AiChatToolCall } from "#shared/rpc/ai/index";

import { parseAskUserToolArguments } from "./ask-user-prompt";

type JsonObject = Record<string, unknown>;

type ToolPresentation = {
  label: string;
  summary: string;
  detail: ReactNode;
};

type ToolPresenter = (toolCall: AiChatToolCall) => ToolPresentation;

function parseObject(text: string | null): JsonObject | null {
  if (text === null || text.trim() === "") {
    return null;
  }
  try {
    const value: unknown = JSON.parse(text);
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

const askUserPresenter: ToolPresenter = (toolCall) => {
  const args = parseAskUserToolArguments(toolCall.argumentsText);
  const question = args?.question ?? "等待补充信息";
  return {
    label: "询问用户",
    summary: question,
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
      </DetailList>
    ) : null,
  };
};

const structurePresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const domain = getString(args, "domain") ?? getString(result, "domain");
  const manuscript = getObject(result?.manuscript);
  const resource = getObject(result?.resource);
  const manuscriptNodes = Array.isArray(manuscript?.nodes) ? manuscript.nodes : [];
  const resourceNodes = Array.isArray(resource?.nodes) ? resource.nodes : [];
  const total = manuscriptNodes.length + resourceNodes.length;
  return {
    label: "读取项目结构",
    summary: `${domainLabel(domain)}${result ? ` · ${total} 个节点` : ""}`,
    detail: (
      <DetailList>
        <DetailField label="范围">{domainLabel(domain)}</DetailField>
        {result ? <DetailField label="节点数">{total}</DetailField> : null}
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
  const target = targetFields(args);
  const content = toolCall.status === "complete" ? toolCall.resultText : null;
  return {
    label: "读取文档",
    summary: `${domainLabel(target.domain)} · ${target.id ?? "未知节点"}`,
    detail: (
      <DetailList>
        <DetailField label="内容域">{domainLabel(target.domain)}</DetailField>
        <DetailField label="节点 ID">{target.id ?? "未知"}</DetailField>
        {content !== null ? <DetailField label="正文规模">{textStats(content)}</DetailField> : null}
      </DetailList>
    ),
  };
};

const searchPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const query = getString(args, "query") ?? "未知关键词";
  const scope = getString(args, "scope");
  const manuscriptHits = Array.isArray(result?.manuscript_hits) ? result.manuscript_hits : [];
  const resourceHits = Array.isArray(result?.resource_hits) ? result.resource_hits : [];
  const hits = [...manuscriptHits, ...resourceHits];
  return {
    label: "搜索项目",
    summary: `“${query}”${result ? ` · ${hits.length} 处命中` : ""}`,
    detail: (
      <DetailList>
        <DetailField label="关键词">{query}</DetailField>
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
  const target = targetFields(args);
  const before = getString(args, "expected_content");
  const after = getString(args, "new_content");
  return {
    label: "重写文档",
    summary: `${domainLabel(target.domain)} · ${target.id ?? "未知节点"}`,
    detail: (
      <DetailList>
        <DetailField label="节点 ID">{target.id ?? "未知"}</DetailField>
        <DetailField label="原正文">{textStats(before)}</DetailField>
        <DetailField label="新正文">{textStats(after)}</DetailField>
        <DetailField label="结果">
          {toolCall.status === "complete" ? "已更新" : "整篇替换"}
        </DetailField>
      </DetailList>
    ),
  };
};

const replacePresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const target = targetFields(args);
  const expected = getString(args, "expected_text");
  const replacement = getString(args, "replacement_text");
  const removing = replacement === "";
  return {
    label: removing ? "删除文档片段" : "替换文档片段",
    summary: `${domainLabel(target.domain)} · ${target.id ?? "未知节点"}`,
    detail: (
      <DetailList>
        <DetailField label="节点 ID">{target.id ?? "未知"}</DetailField>
        <DetailField label="原片段">{textStats(expected)}</DetailField>
        {preview(expected) ? <DetailField label="原文预览">{preview(expected)}</DetailField> : null}
        <DetailField label={removing ? "操作" : "替换片段"}>
          {removing ? "删除匹配片段" : textStats(replacement)}
        </DetailField>
        {!removing && preview(replacement) ? (
          <DetailField label="替换预览">{preview(replacement)}</DetailField>
        ) : null}
      </DetailList>
    ),
  };
};

const createPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result = parseObject(toolCall.resultText);
  const domain = getString(args, "domain");
  const kind = getString(args, "kind");
  const name = getString(args, "name") ?? "未命名节点";
  const content = getString(args, "content");
  return {
    label: `创建${kindLabel(kind)}`,
    summary: `${name} · ${domainLabel(domain)}`,
    detail: (
      <DetailList>
        <DetailField label="名称">{name}</DetailField>
        <DetailField label="类型">{kindLabel(kind)}</DetailField>
        <DetailField label="父节点">{getString(args, "parent_id") ?? "未知"}</DetailField>
        {getNumber(args, "index") !== null ? (
          <DetailField label="插入位置">第 {getNumber(args, "index")! + 1} 位</DetailField>
        ) : null}
        {content !== null ? <DetailField label="初始正文">{textStats(content)}</DetailField> : null}
        {getString(result, "display_path") ? (
          <DetailField label="创建位置">{getString(result, "display_path")}</DetailField>
        ) : null}
      </DetailList>
    ),
  };
};

const presenters: Partial<Record<string, ToolPresenter>> = {
  ask_user: askUserPresenter,
  get_project_structure: structurePresenter,
  read_text_document: readPresenter,
  search_project: searchPresenter,
  edit_text_document: editPresenter,
  replace_text_document: replacePresenter,
  create_document: createPresenter,
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
