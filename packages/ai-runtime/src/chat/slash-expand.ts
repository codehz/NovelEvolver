import type { AiChatSlashRef } from "@novelevolver/domain/ai";

/**
 * Expand a menu-confirmed slash ref + remainder into model-facing user text.
 * - no slash → trimmed remainder
 * - slash only → body
 * - slash + remainder → `body\n\nremainder`
 */
export function expandSlashForModel(
  slash: AiChatSlashRef | null | undefined,
  text: string,
): string {
  const remainder = text.trim();
  if (!slash) {
    return remainder;
  }
  const body = slash.body;
  if (remainder === "") {
    return body;
  }
  return `${body}\n\n${remainder}`;
}

/** Display / title / search form: `/{slug}` + optional remainder. */
export function formatUserMessageDisplay(
  slash: AiChatSlashRef | null | undefined,
  text: string,
): string {
  if (!slash) {
    return text;
  }
  const remainder = text.trim();
  if (remainder === "") {
    return `/${slash.slug}`;
  }
  // Preserve original remainder spacing after the chip in the composer when
  // present; fall back to a single space for stored plain remainder.
  const prefix = text.startsWith("\n") || text.startsWith(" ") || text.startsWith("\t") ? "" : " ";
  return `/${slash.slug}${prefix}${text}`;
}
