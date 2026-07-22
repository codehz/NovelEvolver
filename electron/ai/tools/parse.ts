import type { ToolCallItem } from "@codehz/ai";

export function parseToolArgs(call: ToolCallItem): Record<string, unknown> {
  const argumentsText = call.argumentsText.trim();
  if (argumentsText === "") {
    return {};
  }

  const parsed: unknown = JSON.parse(argumentsText);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("工具参数必须是 JSON 对象。");
  }
  return parsed as Record<string, unknown>;
}

export function parseNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} 需要非空字符串。`);
  }
  return value;
}

export function parseDocumentDomain(value: unknown, fieldName: string): "manuscript" | "resource" {
  if (value === "manuscript" || value === "resource") {
    return value;
  }
  throw new Error(`${fieldName} 必须是 "manuscript" 或 "resource"。`);
}

export function parseScopeDomain(
  value: unknown,
  fieldName: string,
): "manuscript" | "resource" | "all" {
  if (value === undefined) {
    return "all";
  }
  if (value === "manuscript" || value === "resource" || value === "all") {
    return value;
  }
  throw new Error(`${fieldName} 必须是 "manuscript"、"resource" 或 "all"。`);
}

export function parseOptionalIndex(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("index 必须是非负整数。");
  }
  return value;
}

/** resource 域忽略 index 时的统一 warning 文案。 */
export const RESOURCE_INDEX_IGNORED_WARNING = "resource 域不支持 index，已忽略。";

/**
 * manuscript 校验并使用 index；resource 忽略 index（不校验类型）并可选返回 warning。
 */
export function resolveDomainIndex(
  domain: "manuscript" | "resource",
  value: unknown,
): { index: number | undefined; warning: string | null } {
  if (domain === "resource") {
    return {
      index: undefined,
      warning: value !== undefined ? RESOURCE_INDEX_IGNORED_WARNING : null,
    };
  }
  return {
    index: parseOptionalIndex(value),
    warning: null,
  };
}

export function parseDocumentTarget(value: unknown): {
  domain: "manuscript" | "resource";
  id: string;
} {
  if (typeof value !== "object" || value === null) {
    throw new Error("target 需要对象参数。");
  }
  const target = value as Record<string, unknown>;
  return {
    domain: parseDocumentDomain(target.domain, "target.domain"),
    id: parseNonEmptyString(target.id, "target.id"),
  };
}

export function parseExpectedRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("expected_revision 必须是非负整数。");
  }
  return value;
}

export function parseHistoryLimit(value: unknown): number {
  if (value === undefined) {
    return 50;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error("limit 必须是正整数。");
  }
  return Math.min(value, 200);
}

export function parseOptionalPositiveInt(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${fieldName} 必须是正整数。`);
  }
  return value;
}

export function parseOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} 必须是布尔值。`);
  }
  return value;
}
