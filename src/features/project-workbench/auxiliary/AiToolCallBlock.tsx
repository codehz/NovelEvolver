import { useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { DisclosureChevron } from "#app/shared/ui/DisclosureChevron";
import type { AiChatToolCall } from "#shared/rpc/ai-rpc";

import {
  describeToolCallStatus,
  formatToolArguments,
  toolCallBodyClass,
  toolCallLabelClass,
  toolCallPanelClass,
  toolCallQuestionClass,
  toolCallStatusClass,
  toolCallToggleActiveClass,
  toolCallToggleClass,
} from "./ai-chat-ui";
import { parseAskUserToolArguments } from "./ask-user-prompt";

export function AiToolCallBlock({
  toolCall,
  awaitingAskUserToolCallIds,
  activeAskUserToolCallId,
  onSelectAskUserToolCall,
}: {
  toolCall: AiChatToolCall;
  awaitingAskUserToolCallIds: string[];
  activeAskUserToolCallId: string | null;
  onSelectAskUserToolCall: (toolCallId: string) => void;
}) {
  const isAwaitingThisTool = awaitingAskUserToolCallIds.includes(toolCall.id);
  const isActiveAskUser = activeAskUserToolCallId === toolCall.id;
  const isAskUser = toolCall.name === "ask_user";
  const askUserArgs = isAskUser ? parseAskUserToolArguments(toolCall.argumentsText) : null;
  const [expanded, setExpanded] = useState(false);

  const statusText = describeToolCallStatus(toolCall.status);

  return (
    <section className={toolCallPanelClass}>
      <button
        aria-expanded={expanded}
        className={cn(
          toolCallToggleClass,
          isAskUser && isActiveAskUser ? toolCallToggleActiveClass : null,
        )}
        title={expanded ? "收起工具调用" : "展开工具调用"}
        type="button"
        onClick={() => {
          if (isAskUser && isAwaitingThisTool) {
            onSelectAskUserToolCall(toolCall.id);
          }
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

          {isAskUser && askUserArgs?.question ? (
            <div>
              <p className="mb-1 text-2xs font-medium text-ctp-subtext0">问题</p>
              <p className={toolCallQuestionClass}>{askUserArgs.question}</p>
              {askUserArgs.context ? (
                <p className="mt-1 text-2xs text-ctp-subtext1">{askUserArgs.context}</p>
              ) : null}
              {isAwaitingThisTool ? (
                <p className="mt-1 text-2xs text-ctp-blue">请在底部输入框回答。</p>
              ) : null}
            </div>
          ) : null}

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
