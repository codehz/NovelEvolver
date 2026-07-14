import type { EditorState } from "@codemirror/state";

import type { AiPromptConfigPublic } from "#shared/rpc/services/index";

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
