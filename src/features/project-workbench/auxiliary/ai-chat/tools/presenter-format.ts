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
