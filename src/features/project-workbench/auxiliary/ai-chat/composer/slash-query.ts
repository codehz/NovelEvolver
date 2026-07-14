import type { EditorState } from "@codemirror/state";

import type { AiPromptConfigPublic } from "#shared/rpc/services/index";

import { promptChipsField } from "./prompt-chip-extension";

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
 * Detect a slash-command token immediately before the primary caret.
 * Requires `/` at doc start or after whitespace; query is `[a-zA-Z0-9_-]*`.
 *
 * Tokens whose leading `/` sits inside an existing prompt chip are ignored so
 * typing directly after a chip (e.g. `/expand` + `123`) does not reopen the menu.
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

  const line = state.doc.lineAt(caret);
  const textBefore = state.doc.sliceString(line.from, caret);
  const match = /(?:^|[\s\u3000])\/([a-zA-Z0-9_-]*)$/.exec(textBefore);
  if (!match) {
    return null;
  }

  const query = match[1] ?? "";
  const from = caret - query.length - 1;

  // Chip markers are still plain `/{slug}` text under the decoration; reject
  // any token that starts inside (or is) an existing chip range.
  const chips = state.field(promptChipsField, false);
  if (chips) {
    let insideChip = false;
    chips.between(from, from + 1, () => {
      insideChip = true;
      return false;
    });
    if (insideChip) {
      return null;
    }
  }

  return { from, to: caret, query };
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
