import type { AiChatToolCall } from "#shared/rpc/ai/index";

import { getNumber, getObject, getString } from "./presenter-parse";
import type { JsonObject } from "./presenter-types";

export function generationStats(text: string | null, status: AiChatToolCall["status"]): string {
  if (text === null) return "等待正文";
  return status === "pending" ? `正在生成 · ${text.length} 字符` : textStats(text);
}

export function writeIndicator(text: string | null, status: AiChatToolCall["status"]): string {
  if (text === null) {
    return status === "pending" ? "等待正文" : "0 字符";
  }
  return `${text.length} 字符`;
}

export function domainLabel(domain: string | null): string {
  return domain === "manuscript" ? "手稿" : domain === "resource" ? "资源库" : "全部内容";
}

/** Codicon class for a tool activity row. */
export function toolIcon(name: string): string {
  switch (name) {
    case "read_structure":
      return "icon-[codicon--list-tree]";
    case "read_document":
      return "icon-[codicon--file]";
    case "search_documents":
      return "icon-[codicon--search]";
    case "write_document":
      return "icon-[codicon--edit]";
    case "replace_document_text":
      return "icon-[codicon--replace]";
    case "create_folder":
      return "icon-[codicon--new-folder]";
    case "create_document":
      return "icon-[codicon--new-file]";
    case "move_node":
      return "icon-[codicon--export]";
    case "rename_node":
      return "icon-[codicon--tag]";
    case "delete_node":
      return "icon-[codicon--trash]";
    case "read_changes":
    case "read_change":
      return "icon-[codicon--diff]";
    case "read_history":
    case "read_history_entry":
      return "icon-[codicon--history]";
    case "ask_user":
      return "icon-[codicon--comment-discussion]";
    case "run_subagent":
      return "icon-[codicon--hubot]";
    default:
      return "icon-[codicon--tools]";
  }
}

/** Short product action label for a tool (also used by subagent progress). */
export function toolActionLabel(name: string): string {
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
      return "查看变更";
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

export function isWriteToolName(name: string): boolean {
  switch (name) {
    case "write_document":
    case "replace_document_text":
    case "create_folder":
    case "create_document":
    case "move_node":
    case "rename_node":
    case "delete_node":
      return true;
    default:
      return false;
  }
}

/** Tools whose arguments stream a long body field and benefit from live char counts. */
export function isContentWriteToolName(name: string): boolean {
  switch (name) {
    case "create_document":
    case "write_document":
    case "replace_document_text":
      return true;
    default:
      return false;
  }
}

/**
 * Body text currently present in partial tool args (may be incomplete while streaming).
 * `null` means the body field has not appeared yet.
 */
export function contentWriteBodyFromArgs(name: string, args: JsonObject | null): string | null {
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

/**
 * Progressive subject while a content-write tool is still streaming args.
 * Never surfaces bare UUIDs from `target.id`.
 */
export function contentWriteSubjectFromArgs(name: string, args: JsonObject | null): string | null {
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

/** Prefer a readable path/name; never surface bare UUIDs as the primary summary. */
export function displayTargetName(options: {
  displayPath?: string | null;
  label?: string | null;
  id?: string | null;
  fallback?: string;
}): string {
  const path = options.displayPath?.trim();
  if (path) {
    return path;
  }
  const label = options.label?.trim();
  if (label) {
    return label;
  }
  return options.fallback ?? "未知目标";
}

export function truncateText(text: string, max = 48): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function kindLabel(kind: string | null): string {
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

export function textStats(text: string | null): string {
  if (text === null) {
    return "不可用";
  }
  const lines = text === "" ? 0 : text.split(/\r?\n/u).length;
  return `${text.length} 字符 · ${lines} 行`;
}

export function formatStatsObject(stats: JsonObject | null): string | null {
  if (stats === null) {
    return null;
  }
  const charCount = getNumber(stats, "char_count");
  if (charCount === null) {
    return null;
  }
  const lineCount = getNumber(stats, "line_count");
  return lineCount === null ? `${charCount} 字符` : `${charCount} 字符 · ${lineCount} 行`;
}

export function formatDeltaObject(delta: JsonObject | null): string | null {
  if (delta === null) {
    return null;
  }
  const charDelta = getNumber(delta, "char_delta");
  if (charDelta === null) {
    return null;
  }
  const signed = charDelta > 0 ? `+${charDelta}` : `${charDelta}`;
  const lineDelta = getNumber(delta, "line_delta");
  if (lineDelta === null) {
    return `${signed} 字符`;
  }
  const signedLines = lineDelta > 0 ? `+${lineDelta}` : `${lineDelta}`;
  return `${signed} 字符 · ${signedLines} 行`;
}

export function resultTextStats(result: JsonObject | null, contentKey = "content"): string | null {
  const fromStats = formatStatsObject(getObject(result?.stats));
  if (fromStats !== null) {
    return fromStats;
  }
  return result === null ? null : textStats(getString(result, contentKey));
}

export function resultWriteStats(result: JsonObject | null): {
  stats: string | null;
  previous: string | null;
  delta: string | null;
} {
  return {
    stats: formatStatsObject(getObject(result?.stats)),
    previous: formatStatsObject(getObject(result?.previous_stats)),
    delta: formatDeltaObject(getObject(result?.delta)),
  };
}

export function preview(text: string | null): string | null {
  if (!text) {
    return null;
  }
  const compact = text.replace(/\s+/gu, " ").trim();
  return compact.length > 100 ? `${compact.slice(0, 100)}…` : compact;
}

export function targetFields(args: JsonObject | null): {
  domain: string | null;
  id: string | null;
} {
  const target = getObject(args?.target);
  return { domain: getString(target, "domain"), id: getString(target, "id") };
}

export function resultTargetFields(result: JsonObject | null): {
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
