import { cjk } from "@streamdown/cjk";
import type { ReactNode } from "react";
import { Streamdown, type StreamdownProps } from "streamdown";

import { cn } from "#app/shared/lib/ui/cn";

import { MarkdownTableCards } from "./MarkdownTableCards";

/**
 * Compact chat typography: shrink Streamdown's doc-scale headings and make
 * inline code match ambient size (Streamdown defaults to `text-sm`).
 * Use `text-[1em]` (not `text-inherit` — that inherits color only).
 *
 * Code blocks: simple framed box — no copy/download, no line numbers, tight
 * padding, and break-all wrap for long tokens (JSON in a narrow chat rail).
 * Language header stays; actions are off via `controls.code: false`.
 */
const streamClassName = cn(
  "text-inherit",
  "**:data-[streamdown='heading-1']:text-sm",
  "**:data-[streamdown='heading-2']:text-chat",
  "**:data-[streamdown='heading-3']:text-chat",
  "**:data-[streamdown='heading-4']:text-chat",
  "**:data-[streamdown='heading-5']:text-chat",
  "**:data-[streamdown='heading-6']:text-chat",
  "**:data-[streamdown='inline-code']:text-[1em]",
  // Outer shell: Streamdown defaults `my-4 p-2 gap-2 rounded-xl`.
  "**:data-[streamdown='code-block']:my-2 **:data-[streamdown='code-block']:min-w-0 **:data-[streamdown='code-block']:gap-0 **:data-[streamdown='code-block']:rounded-lg **:data-[streamdown='code-block']:p-0",
  // Language label only (controls disabled).
  "**:data-[streamdown='code-block-header']:h-6 **:data-[streamdown='code-block-header']:px-2 **:data-[streamdown='code-block-header']:text-2xs",
  // Body: drop horizontal scroll / nested border / doc-scale padding.
  "**:data-[streamdown='code-block-body']:overflow-x-hidden **:data-[streamdown='code-block-body']:rounded-none **:data-[streamdown='code-block-body']:border-0 **:data-[streamdown='code-block-body']:p-2 **:data-[streamdown='code-block-body']:text-chat",
  // Wrap long lines; re-block line spans (lineNumbers off removes Streamdown's `block`).
  "**:data-[streamdown='code-block-body']_pre:m-0 **:data-[streamdown='code-block-body']_pre:whitespace-pre-wrap **:data-[streamdown='code-block-body']_pre:break-all",
  "**:data-[streamdown='code-block-body']_code>span:block",
);

/** Hang markers outside the content box so wrapped lines align with the text. */
const unorderedListClass = cn(
  "my-1 ml-0 list-outside list-disc pl-5 whitespace-normal",
  "[li_&]:my-0.5 [li_&]:pl-5",
);
const orderedListClass = cn(
  "my-1 ml-0 list-outside list-decimal pl-5 whitespace-normal",
  "[li_&]:my-0.5 [li_&]:pl-5",
);
const listItemClass = cn("py-0.5 [&>p]:inline");

type MarkdownListProps = {
  children?: ReactNode;
  className?: string;
  node?: unknown;
};

function MarkdownUnorderedList({ children, className, node: _node, ...props }: MarkdownListProps) {
  return (
    <ul className={cn(unorderedListClass, className)} data-streamdown="unordered-list" {...props}>
      {children}
    </ul>
  );
}

function MarkdownOrderedList({ children, className, node: _node, ...props }: MarkdownListProps) {
  return (
    <ol className={cn(orderedListClass, className)} data-streamdown="ordered-list" {...props}>
      {children}
    </ol>
  );
}

function MarkdownListItem({ children, className, node: _node, ...props }: MarkdownListProps) {
  return (
    <li className={cn(listItemClass, className)} data-streamdown="list-item" {...props}>
      {children}
    </li>
  );
}

const streamComponents: StreamdownProps["components"] = {
  table: MarkdownTableCards,
  ul: MarkdownUnorderedList,
  ol: MarkdownOrderedList,
  li: MarkdownListItem,
};

const streamControls: StreamdownProps["controls"] = { table: false, code: false };

const streamPlugins: StreamdownProps["plugins"] = { cjk };

type MarkdownStreamProps = {
  children: string;
  isAnimating?: boolean;
};

export function MarkdownStream({ children, isAnimating }: MarkdownStreamProps) {
  return (
    <Streamdown
      animated
      className={streamClassName}
      components={streamComponents}
      controls={streamControls}
      dir="auto"
      isAnimating={isAnimating}
      lineNumbers={false}
      plugins={streamPlugins}
    >
      {children}
    </Streamdown>
  );
}
