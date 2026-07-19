import { Collapsible } from "@base-ui/react/collapsible";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { MarkdownStream } from "#app/shared/ui";
import type { AiChatReasoningPart, AiChatToolCall } from "#shared/rpc/ai/index";

import { presentToolCall } from "../tools/ai-tool-presenters";
import { isWriteToolName } from "../tools/presenter-format";
import {
  collapsiblePanelClass,
  reasoningBodyClass,
  reasoningLabelClass,
  toolCallBodyClass,
  toolCallErrorMessageClass,
  toolCallIconClass,
  toolCallIconErrorClass,
  toolCallIconRunningClass,
  toolCallIconWriteClass,
  toolCallLabelClass,
  toolCallLabelWriteClass,
  toolCallStatusClass,
  toolCallStatusErrorClass,
  toolCallSummaryClass,
  workBlockBodyClass,
  workBlockLabelClass,
  workBlockPanelClass,
  workBlockSummaryClass,
  workBlockToggleClass,
} from "../ui/ai-chat-chrome";
import { describeToolCallStatus, describeWorkSummary } from "../ui/ai-chat-helpers";
import { ClippedLivePanel } from "../ui/ClippedLivePanel";
import { HoverRevealChevron } from "../ui/HoverRevealChevron";
import { TimelineRail, type TimelineRailItemStatus } from "../ui/TimelineRail";
import { useAutoCollapseExpand } from "../ui/use-auto-collapse-expand";
import { isWorkSegmentLive, type AssistantWorkStep } from "./project-assistant-segments";

type AiWorkBlockProps = {
  segmentId: string;
  steps: readonly AssistantWorkStep[];
};

function workStepStatus(step: AssistantWorkStep): TimelineRailItemStatus {
  if (step.type === "reasoning") {
    return step.status === "streaming" ? "running" : "complete";
  }
  if (step.status === "error") {
    return "error";
  }
  if (step.status === "running" || step.status === "pending" || step.status === "awaiting_user") {
    return "running";
  }
  return "complete";
}

function WorkReasoningRow({ part }: { part: AiChatReasoningPart }): ReactNode {
  const [open, setOpen] = useState(part.status === "streaming");

  useEffect(() => {
    if (part.status === "streaming") {
      setOpen(true);
    }
  }, [part.status]);

  const isAnimating = part.status === "streaming";
  const hasBody = part.text !== "";

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="group/disclosure-row flex flex-col"
    >
      <Collapsible.Trigger
        className={cn(
          "flex w-full min-w-0 items-center gap-1.5 text-left text-2xs outline-none",
          "text-ctp-subtext1",
        )}
        title={open ? "收起思考" : "展开思考"}
      >
        <span className={reasoningLabelClass}>思考</span>
        {!hasBody && isAnimating ? <span className="text-ctp-overlay0">…</span> : null}
        <HoverRevealChevron expanded={open} />
      </Collapsible.Trigger>
      <Collapsible.Panel className={collapsiblePanelClass}>
        <div className={reasoningBodyClass}>
          {hasBody ? (
            <MarkdownStream isAnimating={isAnimating}>{part.text}</MarkdownStream>
          ) : (
            <p className="text-ctp-subtext0">…</p>
          )}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function WorkToolRow({ toolCall }: { toolCall: AiChatToolCall }): ReactNode {
  const presentation = presentToolCall(toolCall);
  const hasDetail = presentation.detail != null || Boolean(toolCall.errorMessage);
  const isError = toolCall.status === "error";
  const isRunning = toolCall.status === "running" || toolCall.status === "pending";
  const isWrite = isWriteToolName(toolCall.name);
  const indicator =
    presentation.indicator ??
    (toolCall.status === "complete" ? null : describeToolCallStatus(toolCall.status));

  const [open, setOpen] = useState(
    () => hasDetail && (toolCall.status === "error" || toolCall.status === "awaiting_user"),
  );

  useEffect(() => {
    if (toolCall.status === "error" || toolCall.status === "awaiting_user") {
      setOpen(true);
    }
  }, [toolCall.status]);

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

  const row = (
    <>
      <span aria-hidden="true" className={cn(presentation.icon, iconClass)} />
      <span className={labelClass}>{presentation.label}</span>
      <span className={toolCallSummaryClass}>{presentation.subject}</span>
      {indicator ? <span className={statusClass}>{indicator}</span> : null}
    </>
  );

  if (!hasDetail) {
    return (
      <div className="grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-1.5 text-2xs text-ctp-subtext1">
        {row}
      </div>
    );
  }

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="group/disclosure-row flex flex-col"
    >
      <Collapsible.Trigger
        className={cn(
          "grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-1.5",
          "text-left text-2xs text-ctp-subtext1 outline-none",
        )}
        title={open ? "收起详情" : "展开详情"}
      >
        {row}
        <HoverRevealChevron expanded={open} className="ml-0" />
      </Collapsible.Trigger>
      <Collapsible.Panel className={collapsiblePanelClass}>
        <div className={toolCallBodyClass}>
          {presentation.detail}
          {toolCall.errorMessage ? (
            <p className={toolCallErrorMessageClass}>{toolCall.errorMessage}</p>
          ) : null}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

export function AiWorkBlock({ segmentId, steps }: AiWorkBlockProps): ReactNode {
  const isLive = isWorkSegmentLive(steps);
  const { open, onOpenChange } = useAutoCollapseExpand({ isLive, resetKey: segmentId });
  const summary = describeWorkSummary(steps);

  return (
    <Collapsible.Root
      className={workBlockPanelClass}
      open={open}
      onOpenChange={onOpenChange}
      data-assistant-segment="work"
    >
      <Collapsible.Trigger
        className={workBlockToggleClass}
        title={open ? "收起工作步骤" : "展开工作步骤"}
      >
        <span className={workBlockLabelClass}>工作</span>
        <span className={workBlockSummaryClass}>{summary}</span>
        <HoverRevealChevron expanded={open} />
      </Collapsible.Trigger>

      <Collapsible.Panel className={collapsiblePanelClass}>
        <div className={workBlockBodyClass}>
          <ClippedLivePanel live={isLive}>
            <TimelineRail
              items={steps.map((step) => ({
                id: step.id,
                status: workStepStatus(step),
                content:
                  step.type === "reasoning" ? (
                    <WorkReasoningRow part={step} />
                  ) : (
                    <WorkToolRow toolCall={step} />
                  ),
              }))}
            />
          </ClippedLivePanel>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
