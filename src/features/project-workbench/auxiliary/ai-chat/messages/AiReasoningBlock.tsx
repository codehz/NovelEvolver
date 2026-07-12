import { useEffect, useState } from "react";

import { DisclosureChevron } from "#app/shared/ui/DisclosureChevron";
import { MarkdownStream } from "#app/shared/ui/MarkdownStream";
import type { AiChatReasoningPart } from "#shared/rpc/ai/index";

import {
  reasoningBodyClass,
  reasoningLabelClass,
  reasoningPanelClass,
  reasoningToggleClass,
} from "../ui/ai-chat-ui";

export function AiReasoningBlock({ reasoning }: { reasoning: AiChatReasoningPart }) {
  const [expanded, setExpanded] = useState(reasoning.status === "streaming");

  useEffect(() => {
    if (reasoning.status === "streaming") {
      setExpanded(true);
    }
  }, [reasoning.status]);

  const isAnimating = reasoning.status === "streaming";

  return (
    <section className={reasoningPanelClass}>
      <button
        aria-expanded={expanded}
        className={reasoningToggleClass}
        title={expanded ? "收起思维链" : "展开思维链"}
        type="button"
        onClick={() => {
          setExpanded((current) => !current);
        }}
      >
        <DisclosureChevron expanded={expanded} />
        <span className={reasoningLabelClass}>思考</span>
      </button>

      {expanded ? (
        <div className={reasoningBodyClass}>
          {reasoning.text !== "" ? (
            <MarkdownStream isAnimating={isAnimating}>{reasoning.text}</MarkdownStream>
          ) : (
            <p className="text-ctp-subtext0">...</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
