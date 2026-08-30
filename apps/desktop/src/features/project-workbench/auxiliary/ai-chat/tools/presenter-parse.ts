import { parse as parsePartialJson } from "partial-json";

import type { JsonObject } from "./presenter-types";

export function parseObject(text: string | null): JsonObject | null {
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

export function getObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

export function getString(object: JsonObject | null, key: string): string | null {
  const value = object?.[key];
  return typeof value === "string" ? value : null;
}

export function getNumber(object: JsonObject | null, key: string): number | null {
  const value = object?.[key];
  return typeof value === "number" ? value : null;
}
