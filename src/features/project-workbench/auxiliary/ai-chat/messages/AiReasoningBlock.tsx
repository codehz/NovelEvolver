import { Collapsible } from "@base-ui/react/collapsible";
import { useEffect, useState } from "react";

import { DisclosureChevron } from "#app/shared/ui/DisclosureChevron";
import { MarkdownStream } from "#app/shared/ui/MarkdownStream";
import type { AiChatReasoningPart } from "#shared/rpc/ai/index";

import {
  collapsiblePanelClass,
  reasoningBodyClass,
  reasoningLabelClass,
  reasoningPanelClass,
  reasoningToggleClass,
} from "../ui/ai-chat-ui";

export function AiReasoningBlock({ reasoning }: { reasoning: AiChatReasoningPart }) {
  const [open, setOpen] = useState(reasoning.status === "streaming");

  useEffect(() => {
    if (reasoning.status === "streaming") {
      setOpen(true);
    }
  }, [reasoning.status]);

  const isAnimating = reasoning.status === "streaming";

  return (
    <Collapsible.Root className={reasoningPanelClass} open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger
        className={reasoningToggleClass}
        title={open ? "收起思维链" : "展开思维链"}
      >
        <DisclosureChevron expanded={open} />
        <span className={reasoningLabelClass}>思考</span>
      </Collapsible.Trigger>

      <Collapsible.Panel className={collapsiblePanelClass}>
        <div className={reasoningBodyClass}>
          {reasoning.text !== "" ? (
            <MarkdownStream isAnimating={isAnimating}>{reasoning.text}</MarkdownStream>
          ) : (
            <p className="text-ctp-subtext0">...</p>
          )}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
