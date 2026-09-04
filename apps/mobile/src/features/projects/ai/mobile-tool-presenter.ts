import type { AiChatToolCall, AiToolView, AssistantWorkStep } from "@novelevolver/domain/ai";
import { parse as parsePartialJson } from "partial-json";

export type MobileToolIcon =
  | "comment-discussion"
  | "diff"
  | "edit"
  | "eye"
  | "history"
  | "list-tree"
  | "search"
  | "sparkle"
  | "symbol-event"
  | "tools";

export type MobileToolPresentation = {
  icon: MobileToolIcon;
  label: string;
  subject: string;
  indicator?: string;
  detail: string[];
};

type JsonObject = Record<string, unknown>;

const statusLabel: Record<AiChatToolCall["status"], string> = {
  pending: "准备中",
  running: "进行中",
  awaiting_user: "等待回答",
  complete: "完成",
  error: "失败",
};

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

function domainLabel(domain: string | null): string {
  return domain === "manuscript" ? "手稿" : domain === "resource" ? "资源库" : "全部内容";
}

function textStats(text: string): string {
  const lines = text === "" ? 0 : text.split(/\r?\n/u).length;
  return `${text.length} 字符 · ${lines} 行`;
}

function generationStats(text: string | null, status: AiChatToolCall["status"]): string {
  if (text === null) return "等待正文";
  return status === "pending" ? `正在生成 · ${text.length} 字符` : textStats(text);
}

function toolActionLabel(name: string): string {
  switch (name) {
    case "ask_user":
      return "询问";
    case "run_subagent":
      return "子代理";
    case "read_structure":
      return "查看结构";
    case "read_document":
      return "读取";
    case "search_documents":
      return "搜索";
    case "write_document":
      return "重写";
    case "replace_document_text":
      return "替换片段";
    case "create_folder":
      return "创建文件夹";
    case "create_document":
      return "创建文档";
    case "move_node":
      return "移动节点";
    case "rename_node":
      return "重命名节点";
    case "delete_node":
      return "删除节点";
    case "read_changes":
    case "read_change":
      return "查看变更";
    case "read_history":
      return "查看历史";
    case "read_history_entry":
      return "历史版本";
    default:
      return "工具";
  }
}

function toolIconForName(name: string): MobileToolIcon {
  switch (name) {
    case "search_documents":
      return "search";
    case "read_document":
      return "eye";
    case "read_structure":
      return "list-tree";
    case "write_document":
    case "replace_document_text":
    case "create_document":
      return "edit";
    case "read_changes":
    case "read_change":
      return "diff";
    case "read_history":
    case "read_history_entry":
      return "history";
    case "ask_user":
      return "comment-discussion";
    case "run_subagent":
      return "sparkle";
    case "create_folder":
    case "move_node":
    case "rename_node":
    case "delete_node":
      return "symbol-event";
    default:
      return "tools";
  }
}

function isContentWriteToolName(name: string): boolean {
  switch (name) {
    case "create_document":
    case "write_document":
    case "replace_document_text":
      return true;
    default:
      return false;
  }
}

function contentWriteBodyFromArgs(name: string, args: JsonObject | null): string | null {
  if (args === null) {
    return null;
  }
  switch (name) {
    case "create_document":
      return getString(args, "content");
    case "write_document":
      return getString(args, "new_content");
    case "replace_document_text":
      return getString(args, "replacement_text");
    default:
      return null;
  }
}

function contentWriteSubjectFromArgs(name: string, args: JsonObject | null): string | null {
  if (args === null) {
    return null;
  }
  switch (name) {
    case "create_document": {
      const domain = domainLabel(getString(args, "domain"));
      const docName = getString(args, "name");
      if (docName) {
        return domain !== "全部内容" ? `${domain} · ${docName}` : docName;
      }
      return domain !== "全部内容" ? domain : null;
    }
    case "write_document":
    case "replace_document_text": {
      const target = getObject(args.target);
      const domain = domainLabel(getString(target, "domain"));
      return domain !== "全部内容" ? domain : null;
    }
    default:
      return null;
  }
}

function presentContentWriteProgress(part: AiChatToolCall): MobileToolPresentation {
  const args = parseObject(part.argumentsText);
  const body = contentWriteBodyFromArgs(part.name, args);
  const subject = contentWriteSubjectFromArgs(part.name, args);
  return {
    icon: "edit",
    label: toolActionLabel(part.name),
    subject: subject ?? "…",
    indicator: generationStats(body, part.status),
    detail: [],
  };
}

function presentWithoutView(part: AiChatToolCall): MobileToolPresentation {
  if (isContentWriteToolName(part.name)) {
    return presentContentWriteProgress(part);
  }
  return {
    icon: toolIconForName(part.name),
    label: toolActionLabel(part.name),
    subject: "…",
    detail: [],
  };
}

function viewPresentation(view: AiToolView): Omit<MobileToolPresentation, "indicator"> {
  switch (view.kind) {
    case "search":
      return {
        icon: "search",
        label: "搜索",
        subject: `“${view.query}”`,
        detail: [
          `范围：${view.scopeLabel}`,
          `命中：${view.hitCount} 处`,
          ...view.hits
            .slice(0, 8)
            .map(
              (hit) =>
                `${hit.path}${hit.line == null ? "" : `:${hit.line}`} · ${hit.snippet ?? ""}`,
            ),
        ],
      };
    case "read":
      return {
        icon: "eye",
        label: "读取",
        subject: `${view.domainLabel} · ${view.documentName}`,
        detail: view.scale ? [`规模：${view.scale}`] : [],
      };
    case "structure":
      return {
        icon: "list-tree",
        label: "读取目录",
        subject: view.scopeLabel,
        detail: [
          `节点：${view.nodeCount}`,
          ...(view.textNodeCount != null && view.textCharTotal != null
            ? [`正文：${view.textNodeCount} 个节点 · ${view.textCharTotal} 字符`]
            : []),
        ],
      };
    case "write":
      return {
        icon: "edit",
        label: view.mode === "create" ? "创建" : "写入",
        subject: `${view.domainLabel} · ${view.documentName}`,
        detail: [
          view.previousScale ? `原正文：${view.previousScale}` : "",
          view.nextScale ? `新正文：${view.nextScale}` : "",
          view.delta ? `变更量：${view.delta}` : "",
          ...(view.previews ?? []).map((preview) => `${preview.label}：${preview.text}`),
        ].filter(Boolean),
      };
    case "mutation":
      return {
        icon: "symbol-event",
        label: view.actionLabel,
        subject: `${view.domainLabel} · ${view.display}`,
        detail: view.previousDisplay ? [`此前：${view.previousDisplay}`] : [],
      };
    case "changes":
      return {
        icon: "diff",
        label: "读取变更",
        subject: view.scopeLabel,
        detail: [`数量：${view.count}`, ...view.paths.slice(0, 12)],
      };
    case "change":
      return {
        icon: "diff",
        label: "读取变更",
        subject: `${view.domainLabel} · ${view.documentName}`,
        detail: [
          view.originalScale ? `原正文：${view.originalScale}` : "",
          view.currentScale ? `当前正文：${view.currentScale}` : "",
        ].filter(Boolean),
      };
    case "history":
      return {
        icon: "history",
        label: "读取历史",
        subject: `${view.domainLabel} · ${view.documentName}`,
        detail: [`记录：${view.entryCount} 条`],
      };
    case "history_entry":
      return {
        icon: "history",
        label: "读取历史记录",
        subject: `${view.domainLabel} · ${view.documentName}`,
        detail: [
          view.contentScale ? `正文：${view.contentScale}` : "",
          view.beforeScale ? `此前：${view.beforeScale}` : "",
        ].filter(Boolean),
      };
    case "ask_user":
      return {
        icon: "comment-discussion",
        label: "询问用户",
        subject: view.question,
        detail: [
          view.question,
          ...(view.context ? [`说明：${view.context}`] : []),
          ...(view.choices ?? []).map(
            (choice) =>
              `选项：${choice.title}${choice.description ? ` — ${choice.description}` : ""}`,
          ),
          ...(view.answer ? [`回答：${view.answer}`] : []),
        ],
      };
    case "subagent":
      return {
        icon: "sparkle",
        label: "子代理",
        subject: `${view.agentName} · ${view.phase}`,
        detail: [
          `任务：${view.task}`,
          ...(view.constraints ? [`约束：${view.constraints}`] : []),
          `轮次：${view.round}/${view.maxRounds}`,
          ...view.steps.map(
            (step) =>
              `${step.name}${step.subject ? ` · ${step.subject}` : ""}${step.outcome ? ` · ${step.outcome}` : ""}`,
          ),
          ...(view.report ? [`报告：${view.report}`] : []),
        ],
      };
    case "generic":
      return {
        icon: "tools",
        label: view.label,
        subject: view.subject,
        detail: view.detailLines ?? [],
      };
  }
}

export function presentMobileToolCall(part: AiChatToolCall): MobileToolPresentation {
  if (!part.view) {
    const base = presentWithoutView(part);
    return {
      ...base,
      indicator:
        base.indicator ?? (part.status === "complete" ? undefined : statusLabel[part.status]),
      detail: part.errorMessage ? [...base.detail, `错误：${part.errorMessage}`] : base.detail,
    };
  }
  const base = viewPresentation(part.view);
  return {
    ...base,
    indicator:
      part.status === "complete"
        ? base.detail.length > 0
          ? "完成"
          : undefined
        : statusLabel[part.status],
    detail: part.errorMessage ? [...base.detail, `错误：${part.errorMessage}`] : base.detail,
  };
}

export function describeMobileWork(steps: readonly AssistantWorkStep[]): string {
  const live = steps.some((step) =>
    step.type === "reasoning"
      ? step.status === "streaming"
      : step.status === "pending" || step.status === "running" || step.status === "awaiting_user",
  );
  if (live) {
    const current = [...steps]
      .reverse()
      .find(
        (step) =>
          step.type === "tool_call" && (step.status === "pending" || step.status === "running"),
      );
    return current?.type === "tool_call" ? presentMobileToolCall(current).label : "进行中";
  }
  const errors = steps.filter(
    (step) => step.type === "tool_call" && step.status === "error",
  ).length;
  return `已完成 ${steps.length} 个步骤${errors > 0 ? ` · ${errors} 失败` : ""}`;
}
