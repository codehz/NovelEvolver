import { useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { DisclosureChevron } from "#app/shared/ui/DisclosureChevron";
import type { AiChatToolCall } from "#shared/rpc/ai/index";

import {
  describeToolCallStatus,
  formatToolArguments,
  toolCallBodyClass,
  toolCallLabelClass,
  toolCallPanelClass,
  toolCallQuestionClass,
  toolCallStatusClass,
  toolCallToggleClass,
} from "./ai-chat-ui";
import { parseAskUserToolArguments } from "./ask-user-prompt";

function AskUserDetail({ toolCall }: { toolCall: AiChatToolCall }) {
  const args = parseAskUserToolArguments(toolCall.argumentsText);
  if (!args?.question) {
    return null;
  }

  return (
    <div>
      <p className="mb-1 text-2xs font-medium text-ctp-subtext0">问题</p>
      <p className={toolCallQuestionClass}>{args.question}</p>
      {args.context ? <p className="mt-1 text-2xs text-ctp-subtext1">{args.context}</p> : null}
      {toolCall.status === "awaiting_user" ? (
        <p className="mt-1 text-2xs text-ctp-blue">请在底部输入框回答。</p>
      ) : null}
    </div>
  );
}

/**
 * 工具调用历史展示块（纯展示）。需要用户回答时，交互入口由底部
 * `AskUserComposerPanel` 中的 handle 提供，此块不再承担选中/激活职责。
 */
export function AiToolCallBlock({ toolCall }: { toolCall: AiChatToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const statusText = describeToolCallStatus(toolCall.status);

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
        <span className={toolCallLabelClass}>工具</span>
        <span className="truncate font-mono text-ctp-green">{toolCall.name}</span>
        <span className={toolCallStatusClass}>{statusText}</span>
      </button>

      {expanded ? (
        <div className={toolCallBodyClass}>
          <div>
            <p className="mb-1 text-2xs font-medium text-ctp-subtext0">参数</p>
            <pre>{formatToolArguments(toolCall.argumentsText)}</pre>
          </div>

          {toolCall.status === "running" ? (
            <p className="text-ctp-subtext0">执行工具中...</p>
          ) : null}

          {toolCall.name === "ask_user" ? <AskUserDetail toolCall={toolCall} /> : null}

          {toolCall.resultText ? (
            <div>
              <p className="mb-1 text-2xs font-medium text-ctp-subtext0">结果</p>
              <pre>{toolCall.resultText}</pre>
            </div>
          ) : null}

          {toolCall.errorMessage ? <p className="text-ctp-red">{toolCall.errorMessage}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
