import type { EditorState } from "@codemirror/state";
import type { AiPromptConfigPublic } from "@novelevolver/domain/settings/ai-settings";

import { hasActivePromptChip } from "./prompt-chip-extension";

/** Active `/query` token under the primary caret (collapsed selection only). */
export type SlashQuery = {
  /** Index of the leading `/`. */
  from: number;
  /** End of the query token (caret). */
  to: number;
  /** Text after `/` (may be empty). */
  query: string;
};

/**
 * Detect a leading slash-command token under the primary caret.
 *
 * Rules (single-command redesign):
 * - collapsed selection only
 * - leading `/` must be at document start (`from === 0`)
 * - query is `[a-zA-Z0-9_-]*`
 * - ignored when a prompt chip already exists (at most one slash command)
 */
export function detectSlashQuery(state: EditorState): SlashQuery | null {
  const main = state.selection.main;
  if (!main.empty) {
    return null;
  }

  const caret = main.head;
  if (caret <= 0) {
    return null;
  }

  // Only one slash command per draft: block while any active chip is present.
  if (hasActivePromptChip(state)) {
    return null;
  }

  // Strict document start only (no mid-line / after-whitespace triggers).
  const textBefore = state.doc.sliceString(0, caret);
  const match = /^\/([a-zA-Z0-9_-]*)$/.exec(textBefore);
  if (!match) {
    return null;
  }

  const query = match[1] ?? "";
  return { from: 0, to: caret, query };
}

export type PromptSlashItem = {
  id: string;
  slug: string;
  title: string;
  body: string;
  label: string;
  detail: string;
};

export function toPromptSlashItems(
  prompts: readonly AiPromptConfigPublic[],
): readonly PromptSlashItem[] {
  return prompts.map((prompt) => ({
    id: prompt.id,
    slug: prompt.slug,
    title: prompt.title,
    body: prompt.prompt,
    label: `/${prompt.slug}`,
    detail: prompt.title,
  }));
}

export function filterPromptSlashItems(
  items: readonly PromptSlashItem[],
  query: string,
): readonly PromptSlashItem[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return items;
  }
  return items.filter((item) => {
    return (
      item.slug.toLowerCase().includes(normalized) || item.title.toLowerCase().includes(normalized)
    );
  });
}
