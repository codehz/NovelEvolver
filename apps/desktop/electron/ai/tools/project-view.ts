import type { AiToolView } from "#domain/ai";

import {
  projectToolOutcome,
  projectToolSubject,
  projectToolSubjectFromResult,
} from "./project-subject";

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function tryParseObject(text: string | null | undefined): Record<string, unknown> | null {
  if (typeof text !== "string" || text.trim() === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return asObject(parsed);
  } catch {
    return null;
  }
}

function domainLabel(domain: string | null | undefined): string {
  if (domain === "manuscript") return "手稿";
  if (domain === "resource") return "资源库";
  return "全部内容";
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

function targetName(
  result: Record<string, unknown> | null,
  args: Record<string, unknown> | null,
  fallback = "未知文档",
): string {
  const resultTarget = asObject(result?.target);
  return (
    asString(resultTarget?.display_path) ??
    asString(result?.display_path) ??
    asString(resultTarget?.label) ??
    asString(result?.label) ??
    asString(result?.path) ??
    asString(asObject(args?.target)?.display_path) ??
    asString(args?.name) ??
    asString(asObject(args?.target)?.label) ??
    fallback
  );
}

function previewText(text: string | null, max = 80): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function actionLabel(name: string): string {
  switch (name) {
    case "ask_user":
      return "询问";
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

/**
 * Project a completed (or partial) tool execution into a typed UI view.
 * `result` is the JSON-serializable tool output object when available.
 */
export function projectToolView(input: {
  name: string;
  argumentsText: string | null | undefined;
  result?: unknown;
  resultText?: string | null;
  errorMessage?: string | null;
  answer?: string | null;
}): AiToolView {
  const args = tryParseObject(input.argumentsText);
  const result = asObject(input.result) ?? tryParseObject(input.resultText) ?? null;
  const subject =
    projectToolSubjectFromResult(input.name, input.argumentsText, input.resultText) ??
    projectToolSubject(input.name, input.argumentsText) ??
    actionLabel(input.name);

  switch (input.name) {
    case "search_documents": {
      const hits = [...asArray(result?.manuscript_hits), ...asArray(result?.resource_hits)].map(
        (hit) => {
          const entry = asObject(hit);
          const path =
            asString(entry?.path) ??
            asString(entry?.label) ??
            asString(entry?.display_path) ??
            "未知文档";
          return {
            path,
            line: asNumber(entry?.line),
            snippet: asString(entry?.snippet),
          };
        },
      );
      const query = asString(args?.query) ?? asString(result?.query) ?? "未知关键词";
      const isRegex =
        typeof args?.is_regex === "boolean"
          ? args.is_regex
          : typeof result?.is_regex === "boolean"
            ? result.is_regex
            : false;
      return {
        kind: "search",
        query,
        isRegex,
        scopeLabel: domainLabel(asString(args?.scope) ?? asString(result?.scope)),
        hits,
        hitCount: hits.length,
      };
    }

    case "read_document": {
      const resultTarget = asObject(result?.target);
      const domain =
        asString(resultTarget?.domain) ?? asString(asObject(args?.target)?.domain) ?? null;
      return {
        kind: "read",
        domainLabel: domainLabel(domain),
        documentName: targetName(result, args),
        scale: formatStats(asObject(result?.stats)),
      };
    }

    case "read_structure": {
      const manuscript = asObject(result?.manuscript);
      const resource = asObject(result?.resource);
      const nodes = [...asArray(manuscript?.nodes), ...asArray(resource?.nodes)];
      const nodeCount = asNumber(result?.node_count) ?? nodes.length;
      let textNodeCount = 0;
      let textCharTotal = 0;
      let collapsedCount = 0;
      for (const node of nodes) {
        const entry = asObject(node);
        if (!entry) continue;
        if (entry.expanded === false) collapsedCount += 1;
        const chars = asNumber(entry.char_count);
        if (chars !== null) {
          textNodeCount += 1;
          textCharTotal += chars;
        }
      }
      const domain = asString(asObject(args?.target)?.domain) ?? asString(args?.domain) ?? "all";
      return {
        kind: "structure",
        scopeLabel: domainLabel(domain),
        nodeCount,
        textNodeCount: textNodeCount > 0 ? textNodeCount : null,
        textCharTotal: textNodeCount > 0 ? textCharTotal : null,
        collapsedCount: collapsedCount > 0 ? collapsedCount : null,
      };
    }

    case "write_document": {
      return {
        kind: "write",
        domainLabel: domainLabel(
          asString(asObject(result?.target)?.domain) ?? asString(asObject(args?.target)?.domain),
        ),
        documentName: targetName(result, args),
        mode: "rewrite",
        previousScale: formatStats(asObject(result?.previous_stats)),
        nextScale: formatStats(asObject(result?.stats)),
        delta: formatDelta(asObject(result?.delta)),
        previews: null,
      };
    }

    case "replace_document_text": {
      const replacement = asString(args?.replacement_text);
      const expected = asString(args?.expected_text);
      const removing = replacement === "";
      const previews: Array<{ label: string; text: string }> = [];
      const expectedPreview = previewText(expected);
      if (expectedPreview) previews.push({ label: "原文预览", text: expectedPreview });
      if (!removing) {
        const rep = previewText(replacement);
        if (rep) previews.push({ label: "替换预览", text: rep });
      }
      return {
        kind: "write",
        domainLabel: domainLabel(
          asString(asObject(result?.target)?.domain) ?? asString(asObject(args?.target)?.domain),
        ),
        documentName: targetName(result, args),
        mode: removing ? "delete-span" : "replace",
        previousScale: null,
        nextScale: formatStats(asObject(result?.stats)),
        delta: formatDelta(asObject(result?.delta)),
        previews: previews.length > 0 ? previews : null,
      };
    }

    case "create_document": {
      return {
        kind: "write",
        domainLabel: domainLabel(asString(args?.domain) ?? asString(result?.domain)),
        documentName: targetName(result, args, asString(args?.name) ?? "未命名节点"),
        mode: "create",
        previousScale: null,
        nextScale: formatStats(asObject(result?.stats)),
        delta: null,
        previews: previewText(asString(args?.content))
          ? [{ label: "初始正文预览", text: previewText(asString(args?.content))! }]
          : null,
      };
    }

    case "create_folder":
    case "move_node":
    case "rename_node":
    case "delete_node": {
      const previous = asString(result?.previous_display_path);
      const display =
        asString(result?.display_path) ??
        previous ??
        asString(args?.name) ??
        asString(args?.id) ??
        "未知节点";
      return {
        kind: "mutation",
        actionLabel: actionLabel(input.name),
        domainLabel: domainLabel(asString(args?.domain) ?? asString(result?.domain)),
        display:
          previous && asString(result?.display_path) && previous !== asString(result?.display_path)
            ? `${previous} → ${asString(result?.display_path)}`
            : display,
        previousDisplay: previous,
      };
    }

    case "read_changes": {
      const changes = [
        ...asArray(result?.manuscript_changes),
        ...asArray(result?.resource_changes),
      ];
      const paths = changes.map((change, index) => {
        const entry = asObject(change);
        const path =
          asString(entry?.display_path) ??
          asString(entry?.label) ??
          asString(entry?.path) ??
          `变更 ${index + 1}`;
        const previousPath =
          asString(entry?.previous_path) ?? asString(entry?.previous_display_path);
        return previousPath ? `${previousPath} → ${path}` : path;
      });
      return {
        kind: "changes",
        scopeLabel: domainLabel(asString(result?.domain) ?? asString(args?.domain)),
        paths,
        count: paths.length,
      };
    }

    case "read_change": {
      return {
        kind: "change",
        domainLabel: domainLabel(
          asString(asObject(args?.target)?.domain) ?? asString(result?.domain),
        ),
        documentName: targetName(result, args),
        originalScale: formatStats(asObject(result?.original_stats)),
        currentScale: formatStats(asObject(result?.current_stats)),
      };
    }

    case "read_history": {
      const entries = asArray(result?.entries);
      return {
        kind: "history",
        domainLabel: domainLabel(
          asString(asObject(result?.target)?.domain) ??
            asString(result?.domain) ??
            asString(args?.domain),
        ),
        documentName: targetName(result, args),
        entryCount: entries.length,
      };
    }

    case "read_history_entry": {
      return {
        kind: "history_entry",
        domainLabel: domainLabel(asString(result?.domain) ?? asString(args?.domain)),
        documentName:
          asString(result?.display_path) ??
          asString(result?.label) ??
          asString(args?.entry_id) ??
          "历史版本",
        contentScale: formatStats(asObject(result?.content_stats)),
        beforeScale: formatStats(asObject(result?.before_content_stats)),
      };
    }

    case "ask_user": {
      const choicesRaw = asArray(args?.choices);
      const choices = choicesRaw
        .map((choice) => {
          const entry = asObject(choice);
          const title = asString(entry?.title);
          if (!title) return null;
          const description = asString(entry?.description) ?? undefined;
          return description ? { title, description } : { title };
        })
        .filter((choice): choice is { title: string; description?: string } => choice !== null);
      return {
        kind: "ask_user",
        question: asString(args?.question) ?? "等待补充信息",
        context: asString(args?.context),
        choices: choices.length > 0 ? choices : null,
        answer: input.answer ?? asString(result?.answer),
      };
    }

    default: {
      return {
        kind: "generic",
        label: actionLabel(input.name),
        subject,
        outcome: projectToolOutcome(
          input.name,
          input.resultText ?? null,
          input.errorMessage ?? null,
        ),
        detailLines: null,
      };
    }
  }
}
