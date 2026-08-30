import type { AiChatMentionRef } from "#domain/ai";

/** Structured inline ref the model can feed into read_document / read_structure. */
export function formatMentionForModel(mention: AiChatMentionRef): string {
  const path = mention.displayPath !== "" ? mention.displayPath : mention.label;
  return `@${mention.label} [${mention.domain} ${mention.kind} id=${mention.id} path="${path}"]`;
}

/**
 * Replace each mention `token` in `text` with a structured model-facing ref.
 * Longer tokens win when one is a prefix of another. Tokens not present in
 * `text` are ignored (stale chips). Order of `mentions` does not matter.
 */
export function expandMentionsForModel(
  text: string,
  mentions: readonly AiChatMentionRef[] | null | undefined,
): string {
  if (!mentions || mentions.length === 0) {
    return text;
  }

  const byToken = new Map<string, AiChatMentionRef>();
  for (const mention of mentions) {
    if (mention.token !== "") {
      byToken.set(mention.token, mention);
    }
  }
  if (byToken.size === 0) {
    return text;
  }

  // Longest-first so `@foo/bar` is not partially consumed by `@foo`.
  const tokens = [...byToken.keys()].sort((left, right) => right.length - left.length);

  let result = "";
  let index = 0;
  while (index < text.length) {
    let matched: string | null = null;
    for (const token of tokens) {
      if (text.startsWith(token, index)) {
        matched = token;
        break;
      }
    }
    if (matched !== null) {
      const mention = byToken.get(matched);
      result += mention ? formatMentionForModel(mention) : matched;
      index += matched.length;
      continue;
    }
    result += text[index];
    index += 1;
  }
  return result;
}
