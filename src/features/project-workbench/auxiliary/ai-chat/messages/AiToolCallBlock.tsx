import { Collapsible } from "@base-ui/react/collapsible";
import { useEffect, useRef, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { DisclosureChevron } from "#app/shared/ui";
import type { AiChatToolCall } from "#shared/rpc/ai/index";

import { presentToolCall } from "../tools/ai-tool-presenters";
import { isWriteToolName } from "../tools/presenter-format";
import {
  collapsiblePanelClass,
  toolCallBodyClass,
  toolCallErrorMessageClass,
  toolCallIconClass,
  toolCallIconErrorClass,
  toolCallIconRunningClass,
  toolCallIconWriteClass,
  toolCallLabelClass,
  toolCallLabelWriteClass,
  toolCallPanelClass,
  toolCallQuestionClass,
  toolCallRowClass,
  toolCallStatusClass,
  toolCallStatusErrorClass,
  toolCallSummaryClass,
  toolCallToggleClass,
} from "../ui/ai-chat-chrome";
import { describeToolCallStatus } from "../ui/ai-chat-helpers";

/**
 * 工具调用紧凑活动行（纯展示）。需要用户回答时，交互入口由底部
 * `AskUserComposerPanel` 中的 handle 提供，此块不再承担选中/激活职责。
 */
type AiToolCallBlockProps = { toolCall: AiChatToolCall };

function shouldAutoOpen(toolCall: AiChatToolCall, hasDetail: boolean): boolean {
  if (!hasDetail) {
    return false;
  }
  if (toolCall.name === "run_subagent" && toolCall.status === "running") {
    return true;
  }
  return toolCall.status === "awaiting_user" || toolCall.status === "error";
}

function resolveIndicator(
  toolCall: AiChatToolCall,
  presentationIndicator: string | undefined,
): string | null {
  if (presentationIndicator) {
    return presentationIndicator;
  }
  if (toolCall.status === "complete") {
    return null;
  }
  return describeToolCallStatus(toolCall.status);
}

export function AiToolCallBlock({ toolCall }: AiToolCallBlockProps) {
  const presentation = presentToolCall(toolCall);
  const hasDetail = presentation.detail != null;
  const isRunningSubagent = toolCall.name === "run_subagent" && toolCall.status === "running";
  const isError = toolCall.status === "error";
  const isRunning = toolCall.status === "running" || toolCall.status === "pending";
  const isWrite = isWriteToolName(toolCall.name);
  const indicator = resolveIndicator(toolCall, presentation.indicator);

  const [open, setOpen] = useState(() => shouldAutoOpen(toolCall, hasDetail));
  const userCollapsedRef = useRef(false);
  const autoOpenCallIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldAutoOpen(toolCall, hasDetail)) {
      return;
    }
    if (autoOpenCallIdRef.current !== toolCall.id) {
      autoOpenCallIdRef.current = toolCall.id;
      userCollapsedRef.current = false;
    }
    if (!userCollapsedRef.current) {
      setOpen(true);
    }
  }, [hasDetail, toolCall.id, toolCall.name, toolCall.status]);

  const iconClass = cn(
    isError
      ? toolCallIconErrorClass
      : isRunning
        ? toolCallIconRunningClass
        : isWrite
          ? toolCallIconWriteClass
          : toolCallIconClass,
    isRunning && "animate-pulse",
  );
  const labelClass = isWrite && !isError ? toolCallLabelWriteClass : toolCallLabelClass;
  const statusClass = isError ? toolCallStatusErrorClass : toolCallStatusClass;

  const rowContent = (
    <>
      {hasDetail ? <DisclosureChevron expanded={open} /> : <span className="size-3.5 shrink-0" />}
      <span aria-hidden="true" className={cn(presentation.icon, iconClass)} />
      <span className={labelClass}>{presentation.label}</span>
      <span className={toolCallSummaryClass}>{presentation.subject}</span>
      {indicator ? <span className={statusClass}>{indicator}</span> : null}
    </>
  );

  const body = (
    <div className={toolCallBodyClass}>
      {presentation.detail}

      {toolCall.status === "awaiting_user" ? (
        <p className={toolCallQuestionClass}>请在底部输入框回答。</p>
      ) : null}

      {toolCall.errorMessage ? (
        <p className={toolCallErrorMessageClass}>{toolCall.errorMessage}</p>
      ) : null}
    </div>
  );

  if (!hasDetail) {
    return (
      <div className={toolCallPanelClass}>
        <div className={toolCallRowClass}>{rowContent}</div>
        {toolCall.errorMessage || toolCall.status === "awaiting_user" ? body : null}
      </div>
    );
  }

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
      <Collapsible.Trigger className={toolCallToggleClass} title={open ? "收起详情" : "展开详情"}>
        {rowContent}
      </Collapsible.Trigger>

      <Collapsible.Panel className={collapsiblePanelClass}>{body}</Collapsible.Panel>
    </Collapsible.Root>
  );
}
