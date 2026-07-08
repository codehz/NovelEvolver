import { cjk } from "@streamdown/cjk";
import { Streamdown, type StreamdownProps } from "streamdown";

import { cn } from "#app/shared/lib/ui/cn";

type MarkdownStreamProps = Omit<StreamdownProps, "plugins"> & {
  plugins?: StreamdownProps["plugins"];
};

export function MarkdownStream({
  animated = true,
  className,
  dir = "auto",
  plugins,
  ...props
}: MarkdownStreamProps) {
  return (
    <Streamdown
      animated={animated}
      className={cn("text-inherit", className)}
      dir={dir}
      plugins={{ cjk, ...plugins }}
      {...props}
    />
  );
}
