import { cjk } from "@streamdown/cjk";
import { useMemo } from "react";
import { Streamdown, type ControlsConfig, type StreamdownProps } from "streamdown";

import { cn } from "#app/shared/lib/ui/cn";

import { MarkdownTableCards } from "./MarkdownTableCards";

const markdownStreamComponents: StreamdownProps["components"] = {
  table: MarkdownTableCards,
};

type MarkdownStreamProps = Omit<StreamdownProps, "plugins"> & {
  plugins?: StreamdownProps["plugins"];
};

function mergeTableControls(controls: ControlsConfig | undefined): ControlsConfig {
  if (controls === false) {
    return false;
  }

  const base = typeof controls === "object" ? controls : {};
  return { ...base, table: false };
}

export function MarkdownStream({
  animated = true,
  className,
  components,
  controls,
  dir = "auto",
  plugins,
  ...props
}: MarkdownStreamProps) {
  return (
    <Streamdown
      animated={animated}
      className={cn("text-inherit", className)}
      components={useMemo(() => ({ ...markdownStreamComponents, ...components }), [components])}
      controls={mergeTableControls(controls)}
      dir={dir}
      plugins={{ cjk, ...plugins }}
      {...props}
    />
  );
}
