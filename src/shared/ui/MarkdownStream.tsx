import { cjk } from "@streamdown/cjk";
import type { ReactNode } from "react";
import { Streamdown, type StreamdownProps } from "streamdown";

import { cn } from "#app/shared/lib/ui/cn";

import { MarkdownTableCards } from "./MarkdownTableCards";

const streamClassName = cn("text-inherit");

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

const streamControls: StreamdownProps["controls"] = { table: false };

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
      plugins={streamPlugins}
    >
      {children}
    </Streamdown>
  );
}
