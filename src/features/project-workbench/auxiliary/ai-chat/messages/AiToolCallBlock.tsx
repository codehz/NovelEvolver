import { useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { DisclosureChevron } from "#app/shared/ui/DisclosureChevron";
import type { AiChatToolCall } from "#shared/rpc/ai/index";

import { presentToolCall } from "../tools/ai-tool-presenters";
import {
  describeToolCallStatus,
  toolCallBodyClass,
  toolCallLabelClass,
  toolCallPanelClass,
  toolCallQuestionClass,
  toolCallStatusClass,
  toolCallToggleClass,
} from "../ui/ai-chat-ui";

/**
 * 工具调用历史展示块（纯展示）。需要用户回答时，交互入口由底部
 * `AskUserComposerPanel` 中的 handle 提供，此块不再承担选中/激活职责。
 */
export function AiToolCallBlock({ toolCall }: { toolCall: AiChatToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const presentation = presentToolCall(toolCall);
  const indicator = presentation.indicator ?? describeToolCallStatus(toolCall.status);

  return (
    <section className={toolCallPanelClass}>
      <button
        aria-expanded={expanded}
        className={cn(toolCallToggleClass)}
        title={expanded ? "收起工具调用" : "展开工具调用"}
        type="button"
        onClick={() => {
          setExpanded((current) => !current);
        }}
      >
        <DisclosureChevron expanded={expanded} />
        <span className={toolCallLabelClass}>{presentation.label}</span>
        <span className="min-w-0 truncate text-ctp-subtext1">{presentation.summary}</span>
        <span className={toolCallStatusClass}>{indicator}</span>
      </button>

      {expanded ? (
        <div className={toolCallBodyClass}>
          {presentation.detail}

          {toolCall.status === "running" ? (
            <p className="text-ctp-subtext0">执行工具中...</p>
          ) : null}

          {toolCall.status === "awaiting_user" ? (
            <p className={toolCallQuestionClass}>请在底部输入框回答。</p>
          ) : null}

          {toolCall.errorMessage ? <p className="text-ctp-red">{toolCall.errorMessage}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
