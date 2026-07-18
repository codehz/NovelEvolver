import { Collapsible } from "@base-ui/react/collapsible";
import { useEffect, useRef, useState } from "react";

import { DisclosureChevron } from "#app/shared/ui";
import type { AiChatToolCall } from "#shared/rpc/ai/index";

import { presentToolCall } from "../tools/ai-tool-presenters";
import {
  collapsiblePanelClass,
  toolCallBodyClass,
  toolCallLabelClass,
  toolCallPanelClass,
  toolCallQuestionClass,
  toolCallStatusClass,
  toolCallToggleClass,
} from "../ui/ai-chat-chrome";
import { describeToolCallStatus } from "../ui/ai-chat-helpers";

/**
 * 工具调用历史展示块（纯展示）。需要用户回答时，交互入口由底部
 * `AskUserComposerPanel` 中的 handle 提供，此块不再承担选中/激活职责。
 */
type AiToolCallBlockProps = { toolCall: AiChatToolCall };

export function AiToolCallBlock({ toolCall }: AiToolCallBlockProps) {
  const [open, setOpen] = useState(false);
  const userCollapsedRef = useRef(false);
  const autoOpenCallIdRef = useRef<string | null>(null);
  const presentation = presentToolCall(toolCall);
  const indicator = presentation.indicator ?? describeToolCallStatus(toolCall.status);
  const isRunningSubagent = toolCall.name === "run_subagent" && toolCall.status === "running";

  useEffect(() => {
    if (!isRunningSubagent) {
      return;
    }
    if (autoOpenCallIdRef.current !== toolCall.id) {
      autoOpenCallIdRef.current = toolCall.id;
      userCollapsedRef.current = false;
    }
    if (!userCollapsedRef.current) {
      setOpen(true);
    }
  }, [isRunningSubagent, toolCall.id]);

  return (
    <Collapsible.Root
      className={toolCallPanelClass}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && isRunningSubagent) {
          userCollapsedRef.current = true;
        }
      }}
    >
      <Collapsible.Trigger
        className={toolCallToggleClass}
        title={open ? "收起工具调用" : "展开工具调用"}
      >
        <DisclosureChevron expanded={open} />
        <span className={toolCallLabelClass}>{presentation.label}</span>
        <span className="min-w-0 truncate text-ctp-subtext1">{presentation.summary}</span>
        <span className={toolCallStatusClass}>{indicator}</span>
      </Collapsible.Trigger>

      <Collapsible.Panel className={collapsiblePanelClass}>
        <div className={toolCallBodyClass}>
          {presentation.detail}

          {toolCall.status === "running" && toolCall.name !== "run_subagent" ? (
            <p className="text-ctp-subtext0">执行工具中...</p>
          ) : null}

          {toolCall.status === "awaiting_user" ? (
            <p className={toolCallQuestionClass}>请在底部输入框回答。</p>
          ) : null}

          {toolCall.errorMessage ? <p className="text-ctp-red">{toolCall.errorMessage}</p> : null}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
