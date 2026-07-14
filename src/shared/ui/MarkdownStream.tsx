import { cjk } from "@streamdown/cjk";
import { Streamdown, type StreamdownProps } from "streamdown";

import { cn } from "#app/shared/lib/ui/cn";

import { MarkdownTableCards } from "./MarkdownTableCards";

const streamClassName = cn("text-inherit");

const streamComponents: StreamdownProps["components"] = {
  table: MarkdownTableCards,
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
