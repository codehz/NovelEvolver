import type {
  AiChatMentionRef,
  AiChatSendMessageInput,
  AiChatSlashRef,
} from "@novelevolver/domain/ai";
import type { AiPromptConfigPublic } from "@novelevolver/domain/settings/ai-settings";

import type { MentionCatalogItem } from "./mention-catalog";

export type ComposerTrigger = "/" | "@";

export function filterPromptItems(
  prompts: readonly AiPromptConfigPublic[],
  query: string,
): readonly AiPromptConfigPublic[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return prompts;
  }
  return prompts.filter(
    (prompt) =>
      prompt.slug.toLowerCase().includes(normalized) ||
      prompt.title.toLowerCase().includes(normalized),
  );
}

export function filterMentionCatalog(
  items: readonly MentionCatalogItem[],
  query: string,
): readonly MentionCatalogItem[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return items;
  }
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(normalized) ||
      item.displayPath.toLowerCase().includes(normalized),
  );
}

export function isValidSlashQuery(text: string): boolean {
  return /^\/[a-zA-Z0-9_-]*$/.test(text);
}

export function isValidMentionQuery(text: string): boolean {
  return /(^|[\s([{（【「『"'`，。、；：！？,.!?;:])@[0-9A-Za-z_\-./\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]*$/.test(
    text,
  );
}

export function buildComposerSendPayload(
  text: string,
  slash: AiChatSlashRef | null,
  mentions: readonly AiChatMentionRef[],
): AiChatSendMessageInput {
  if (slash === null) {
    return { text, slash: null, mentions };
  }
  const marker = `/${slash.slug}`;
  return {
    text: text.startsWith(marker) ? text.slice(marker.length) : text,
    slash,
    mentions,
  };
}

export function isComposerEmpty(
  text: string,
  slash: AiChatSlashRef | null,
  mentions: readonly AiChatMentionRef[],
): boolean {
  const payload = buildComposerSendPayload(text, slash, mentions);
  return (
    payload.slash == null && (payload.mentions?.length ?? 0) === 0 && payload.text.trim() === ""
  );
}
