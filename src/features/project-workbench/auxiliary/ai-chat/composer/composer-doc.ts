import type { EditorState } from "@codemirror/state";

import type {
  AiChatMentionRef,
  AiChatSendMessageInput,
  AiChatSlashRef,
} from "#shared/rpc/ai/index";

import { collectMentionChips } from "./mention-chip-extension";
import { getActivePromptChip } from "./prompt-chip-extension";

function firstPromptChip(state: EditorState): {
  from: number;
  to: number;
  slash: AiChatSlashRef;
} | null {
  const chip = getActivePromptChip(state);
  if (!chip) {
    return null;
  }
  return {
    from: chip.from,
    to: chip.to,
    slash: {
      promptId: chip.data.promptId,
      slug: chip.data.slug,
      title: chip.data.title,
      body: chip.data.body,
    },
  };
}

function collectMentionsInOrder(state: EditorState): AiChatMentionRef[] {
  return collectMentionChips(state).map((chip) => ({ ...chip.data }));
}

/**
 * Build the structured send payload.
 * Confirmed slash chip → `{ slash, text: remainder }`; plain draft → `{ text, slash: null }`.
 * Mentions are always collected in document order (tokens remain inside `text`).
 * Does **not** expand prompt body or mention refs (backend does that for the model).
 */
export function buildComposerSendPayload(state: EditorState): AiChatSendMessageInput {
  const mentions = collectMentionsInOrder(state);
  const chip = firstPromptChip(state);
  if (!chip) {
    return {
      text: state.doc.toString(),
      slash: null,
      mentions,
    };
  }

  // Prefer chip at document start; if a chip somehow sits mid-doc, still take
  // text after it as remainder (defensive — normal path inserts at 0).
  const remainder = state.doc.sliceString(chip.to, state.doc.length);
  return {
    text: remainder,
    slash: chip.slash,
    mentions,
  };
}

export function isComposerStateEmpty(state: EditorState): boolean {
  const payload = buildComposerSendPayload(state);
  if (payload.slash) {
    return false;
  }
  if ((payload.mentions?.length ?? 0) > 0) {
    return false;
  }
  return payload.text.trim() === "";
}
