/**
 * Pure human-readable subject / outcome projection for tool activity rows.
 * Used by subagent timeline steps and (Phase 2) top-level tool views.
 * Never include full document content.
 */

function tryParseObject(text: string | null | undefined): Record<string, unknown> | null {
  if (typeof text !== "string" || text.trim() === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function domainLabel(domain: string | null): string | null {
  if (domain === "manuscript") return "手稿";
  if (domain === "resource") return "资源库";
  if (domain === "all") return "全部内容";
  return domain;
}

function targetDisplay(record: Record<string, unknown> | null): string | null {
  if (!record) return null;
  return (
    asString(record.display_path) ??
    asString(record.path) ??
    asString(record.label) ??
    asString(record.name) ??
    null
  );
}

function formatStats(stats: Record<string, unknown> | null): string | null {
  if (!stats) return null;
  const chars = asNumber(stats.char_count);
  if (chars === null) return null;
  const lines = asNumber(stats.line_count);
  return lines === null ? `${chars} 字符` : `${chars} 字符 · ${lines} 行`;
}

function formatDelta(delta: Record<string, unknown> | null): string | null {
  if (!delta) return null;
  const charDelta = asNumber(delta.char_delta);
  if (charDelta === null) return null;
  const signed = charDelta > 0 ? `+${charDelta}` : `${charDelta}`;
  const lineDelta = asNumber(delta.line_delta);
  if (lineDelta === null) return `${signed} 字符`;
  const signedLines = lineDelta > 0 ? `+${lineDelta}` : `${lineDelta}`;
  return `${signed} 字符 · ${signedLines} 行`;
}

/** Subject for collapsed row / timeline step (target of the action). */
export function projectToolSubject(
  name: string,
  argumentsText: string | null | undefined,
): string | null {
  const args = tryParseObject(argumentsText);
  if (!args) return null;

  switch (name) {
    case "search_documents": {
      const query = asString(args.query);
      return query ? `“${query}”` : null;
    }
    case "read_structure": {
      const target = asObject(args.target);
      return domainLabel(asString(target?.domain) ?? asString(args.domain) ?? "all");
    }
    case "read_document":
    case "write_document":
    case "replace_document_text":
    case "read_change":
    case "read_history": {
      const target = asObject(args.target) ?? args;
      return targetDisplay(target) ?? domainLabel(asString(target.domain));
    }
    case "create_document":
    case "create_folder":
      return asString(args.name);
    case "move_node":
    case "rename_node":
    case "delete_node":
      return asString(args.name) ?? asString(args.id);
    case "read_changes":
      return domainLabel(asString(args.domain) ?? "all");
    case "read_history_entry":
      return asString(args.entry_id);
    case "ask_user":
      return asString(args.question);
    case "run_subagent":
      return asString(args.task);
    default:
      return null;
  }
}

/** Outcome chip after a tool finishes. */
export function projectToolOutcome(
  name: string,
  resultText: string | null | undefined,
  errorMessage: string | null | undefined,
): string | null {
  if (errorMessage) {
    return "失败";
  }
  const result = tryParseObject(resultText);
  if (!result) {
    return resultText ? "完成" : null;
  }

  switch (name) {
    case "search_documents": {
      const manuscript = Array.isArray(result.manuscript_hits) ? result.manuscript_hits.length : 0;
      const resource = Array.isArray(result.resource_hits) ? result.resource_hits.length : 0;
      return `${manuscript + resource} 处命中`;
    }
    case "read_structure": {
      const count = asNumber(result.node_count);
      return count === null ? "完成" : `${count} 个节点`;
    }
    case "read_document":
      return formatStats(asObject(result.stats)) ?? "已读取";
    case "write_document":
    case "replace_document_text":
    case "create_document":
      return formatDelta(asObject(result.delta)) ?? formatStats(asObject(result.stats)) ?? "已写入";
    case "create_folder":
      return "已创建";
    case "move_node":
      return "已移动";
    case "rename_node":
      return "已重命名";
    case "delete_node":
      return "已删除";
    case "read_changes": {
      const m = Array.isArray(result.manuscript_changes) ? result.manuscript_changes.length : 0;
      const r = Array.isArray(result.resource_changes) ? result.resource_changes.length : 0;
      return `${m + r} 项`;
    }
    case "read_change":
      return (
        formatStats(asObject(result.current_stats)) ??
        formatStats(asObject(result.original_stats)) ??
        "完成"
      );
    case "read_history": {
      const entries = Array.isArray(result.entries) ? result.entries.length : 0;
      return `${entries} 条`;
    }
    case "read_history_entry":
      return formatStats(asObject(result.content_stats)) ?? "完成";
    case "ask_user":
      return "已回答";
    default:
      return "完成";
  }
}

/** Prefer result-side display path over args when available. */
export function projectToolSubjectFromResult(
  name: string,
  argumentsText: string | null | undefined,
  resultText: string | null | undefined,
): string | null {
  const result = tryParseObject(resultText);
  if (result) {
    const target = asObject(result.target);
    const fromResult =
      targetDisplay(target) ??
      targetDisplay(result) ??
      asString(result.display_path) ??
      asString(result.path);
    if (fromResult) {
      const domain = domainLabel(asString(target?.domain) ?? asString(result.domain)) ?? null;
      if (
        domain &&
        (name === "read_document" ||
          name === "write_document" ||
          name === "replace_document_text" ||
          name === "read_change" ||
          name === "read_history")
      ) {
        return `${domain} · ${fromResult}`;
      }
      return fromResult;
    }
  }
  const fromArgs = projectToolSubject(name, argumentsText);
  if (!fromArgs) return null;
  const args = tryParseObject(argumentsText);
  const domain = domainLabel(
    asString(asObject(args?.target)?.domain) ?? asString(args?.domain) ?? null,
  );
  if (
    domain &&
    fromArgs !== domain &&
    (name === "read_document" ||
      name === "write_document" ||
      name === "replace_document_text" ||
      name === "create_document" ||
      name === "create_folder" ||
      name === "move_node" ||
      name === "rename_node" ||
      name === "delete_node" ||
      name === "read_change" ||
      name === "read_history")
  ) {
    return `${domain} · ${fromArgs}`;
  }
  return fromArgs;
}
