import type { EditorState } from "@codemirror/state";

import type { AiChatMentionRef } from "#domain/ai";

import { mentionChipEndsAt, rangeOverlapsMentionChip } from "./mention-chip-extension";
import { promptChipEndsAt } from "./prompt-chip-extension";

/** Active `@query` token under the primary caret (collapsed selection only). */
export type MentionQuery = {
  /** Index of the leading `@`. */
  from: number;
  /** End of the query token (caret). */
  to: number;
  /** Text after `@` (may be empty). */
  query: string;
};

/**
 * Characters allowed inside an in-progress mention query (after `@`).
 * Includes path separators and CJK so novel titles filter naturally.
 */
const MENTION_QUERY_CHAR = /[0-9A-Za-z_\-./\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

function isMentionBoundary(char: string | undefined): boolean {
  if (char === undefined) {
    return true;
  }
  // Whitespace or common punctuation — not mid-token (avoids email `a@b`).
  return /[\s([{（【「『"'`，。、；：！？,.!?;:]/.test(char);
}

/**
 * Slash/mention chips are atomic widgets whose underlying doc text is still
 * `/slug` or `@path`. Typing `@` immediately after a chip looks like a new
 * token to the user, but the raw char before `@` is a letter — treat chip end
 * as a boundary so `/expand@…` opens mention without requiring a space.
 */
function isAfterComposerChip(state: EditorState, pos: number): boolean {
  return promptChipEndsAt(state, pos) || mentionChipEndsAt(state, pos);
}

/**
 * Detect an active `@mention` query under the primary caret.
 *
 * Rules:
 * - collapsed selection only
 * - `@` preceded by start-of-doc, a boundary char, or the end of a composer chip
 *   (not email-like mid-word)
 * - query is continuous non-space mention chars
 * - ignored when caret sits inside an existing mention chip atomic range
 */
export function detectMentionQuery(state: EditorState): MentionQuery | null {
  const main = state.selection.main;
  if (!main.empty) {
    return null;
  }

  const caret = main.head;
  if (caret <= 0) {
    return null;
  }

  // Walk left from caret over query chars until `@` or a hard stop.
  let index = caret;
  while (index > 0) {
    const ch = state.doc.sliceString(index - 1, index);
    if (ch === "@") {
      break;
    }
    if (!MENTION_QUERY_CHAR.test(ch)) {
      return null;
    }
    index -= 1;
  }

  if (index <= 0) {
    return null;
  }
  const atChar = state.doc.sliceString(index - 1, index);
  if (atChar !== "@") {
    return null;
  }

  const from = index - 1;
  const before = from === 0 ? undefined : state.doc.sliceString(from - 1, from);
  if (!isMentionBoundary(before) && !isAfterComposerChip(state, from)) {
    return null;
  }

  // Caret inside an existing mention chip → do not reopen.
  if (rangeOverlapsMentionChip(state, from, caret)) {
    return null;
  }

  const query = state.doc.sliceString(from + 1, caret);
  return { from, to: caret, query };
}

export type MentionCatalogItem = {
  domain: AiChatMentionRef["domain"];
  id: string;
  kind: AiChatMentionRef["kind"];
  label: string;
  displayPath: string;
  /** Primary row label (`@label`). */
  rowLabel: string;
  /** Secondary path detail. */
  detail: string;
  /** Kind badge text. */
  kindLabel: string;
};

export function kindLabelFor(
  kind: AiChatMentionRef["kind"],
  domain: AiChatMentionRef["domain"],
): string {
  if (kind === "folder") {
    return domain === "manuscript" ? "文件夹" : "资源文件夹";
  }
  if (kind === "chapter") {
    return "章节";
  }
  return "资源";
}

export function filterMentionItems(
  items: readonly MentionCatalogItem[],
  query: string,
): readonly MentionCatalogItem[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") {
    return items;
  }
  return items.filter((item) => {
    return (
      item.label.toLowerCase().includes(normalized) ||
      item.displayPath.toLowerCase().includes(normalized)
    );
  });
}

/**
 * Build a stable in-document token for a mention chip.
 * Prefer `@displayPath`; fall back to `@label`. Disambiguate collisions with `#idSlice`.
 */
export function buildMentionToken(
  item: Pick<MentionCatalogItem, "id" | "label" | "displayPath">,
  existingTokens: ReadonlySet<string>,
): string {
  const basePath = item.displayPath !== "" ? item.displayPath : item.label;
  const preferred = `@${basePath}`;
  if (!existingTokens.has(preferred)) {
    return preferred;
  }
  const shortId = item.id.length > 8 ? item.id.slice(0, 8) : item.id;
  const disambiguated = `@${basePath}#${shortId}`;
  if (!existingTokens.has(disambiguated)) {
    return disambiguated;
  }
  // Extremely rare: keep appending id until unique.
  let n = 1;
  while (existingTokens.has(`${disambiguated}-${n}`)) {
    n += 1;
  }
  return `${disambiguated}-${n}`;
}

export function toMentionRef(item: MentionCatalogItem, token: string): AiChatMentionRef {
  return {
    domain: item.domain,
    id: item.id,
    kind: item.kind,
    label: item.label,
    displayPath: item.displayPath,
    token,
  };
}
