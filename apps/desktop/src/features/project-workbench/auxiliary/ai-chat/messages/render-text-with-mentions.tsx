import type { ReactNode } from "react";

import type { AiChatMentionRef } from "#domain/ai";

import { userMentionChipClass } from "../ui/ai-chat-chrome";

function mentionTitle(mention: AiChatMentionRef): string {
  const kind =
    mention.kind === "folder"
      ? mention.domain === "manuscript"
        ? "文件夹"
        : "资源文件夹"
      : mention.kind === "chapter"
        ? "章节"
        : "资源";
  if (mention.displayPath !== "" && mention.displayPath !== mention.label) {
    return `${mention.displayPath}\n${kind}`;
  }
  return kind;
}

/**
 * Split user text on mention tokens (longest-first) and render chips for matches.
 */
export function renderTextWithMentions(
  text: string,
  mentions: readonly AiChatMentionRef[],
): ReactNode {
  if (mentions.length === 0 || text === "") {
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

  const tokens = [...byToken.keys()].sort((left, right) => right.length - left.length);
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;

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
      if (mention) {
        nodes.push(
          <span key={`m-${key++}`} className={userMentionChipClass} title={mentionTitle(mention)}>
            @{mention.label}
          </span>,
        );
      } else {
        nodes.push(matched);
      }
      index += matched.length;
      continue;
    }

    // Accumulate plain run until next potential `@` or end.
    const nextAt = text.indexOf("@", index + 1);
    const end = nextAt === -1 ? text.length : nextAt;
    nodes.push(text.slice(index, end));
    index = end;
  }

  return nodes;
}
