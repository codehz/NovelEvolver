import { Collapsible } from "@base-ui/react/collapsible";
import { useState, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type { AiChatToolCall } from "#shared/rpc/ai/index";

import { maybeErrorTechnicalFields } from "../tools/presenter-detail";
import { toolIcon } from "../tools/presenter-format";
import {
  collapsiblePanelClass,
  elevatedCardBodyClass,
  elevatedCardHeaderClass,
  elevatedCardPanelClass,
  toolCallErrorMessageClass,
  toolCallIconClass,
  toolCallIconErrorClass,
  toolCallIconRunningClass,
} from "../ui/ai-chat-chrome";
import { ClippedLivePanel } from "../ui/ClippedLivePanel";
import { HoverRevealChevron } from "../ui/HoverRevealChevron";
import { TimelineRail } from "../ui/TimelineRail";
import { useAutoCollapseExpand } from "../ui/use-auto-collapse-expand";
import {
  describeSubagentCardSummary,
  describeSubagentStepLine,
  mapSubagentStepStatus,
  readSubagentCardModel,
} from "./subagent-card-model";

type AiSubagentCardProps = {
  toolCall: AiChatToolCall;
};

export function AiSubagentCard({ toolCall }: AiSubagentCardProps): ReactNode {
  const model = readSubagentCardModel(toolCall);
  const { open, onOpenChange } = useAutoCollapseExpand({
    isLive: model.isLive,
    resetKey: toolCall.id,
  });
  const [reportOpen, setReportOpen] = useState(false);

  const summary = describeSubagentCardSummary(model);
  const iconClass = cn(
    model.isError
      ? toolCallIconErrorClass
      : model.isLive
        ? toolCallIconRunningClass
        : toolCallIconClass,
    model.isLive && "animate-pulse",
  );

  return (
    <Collapsible.Root
      className={elevatedCardPanelClass}
      open={open}
      onOpenChange={onOpenChange}
      data-assistant-segment="subagent"
    >
      <Collapsible.Trigger
        className={elevatedCardHeaderClass}
        title={open ? "收起子代理" : "展开子代理"}
      >
        <span aria-hidden="true" className={cn(toolIcon("run_subagent"), iconClass)} />
        <span className="shrink-0 font-medium tracking-[0.02em] text-ctp-subtext1">子代理</span>
        <span className="min-w-0 flex-1 truncate text-ctp-subtext0">{summary}</span>
        <HoverRevealChevron expanded={open} />
      </Collapsible.Trigger>

      {!open && model.report ? (
        <p className="line-clamp-1 px-2 pb-1.5 text-chat-meta text-app-muted">{model.report}</p>
      ) : null}

      <Collapsible.Panel className={collapsiblePanelClass}>
        <div className={elevatedCardBodyClass}>
          <div className="flex flex-col gap-0.5">
            <p className="text-app-foreground">{model.agentLabel}</p>
            <p className="min-w-0 wrap-break-word text-ctp-subtext0">{model.task}</p>
            {model.constraints ? (
              <p className="min-w-0 text-2xs wrap-break-word text-ctp-overlay0">
                约束：{model.constraints}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-ctp-overlay0">
              {model.phaseLabel ? <span>{model.phaseLabel}</span> : null}
              {model.round > 0 ? (
                <span>
                  第 {model.round}/{model.maxRounds} 轮
                </span>
              ) : null}
              {!model.isLive && model.stepCount > 0 ? <span>{model.stepCount} 步</span> : null}
              {model.wrote !== null ? <span>{model.wrote ? "已写回" : "只读"}</span> : null}
              {model.touchedCount > 0 ? <span>触及 {model.touchedCount} 个节点</span> : null}
            </div>
          </div>

          <ClippedLivePanel live={model.isLive}>
            {model.view ? (
              <TimelineRail
                empty={
                  <p className="text-ctp-subtext0">
                    {model.view.phase === "done"
                      ? "未调用子工具"
                      : `${model.phaseLabel ?? "执行"}…`}
                  </p>
                }
                items={model.view.steps.map((step) => {
                  const failed = step.status === "error";
                  const running = step.status === "running";
                  const line = describeSubagentStepLine(step);
                  return {
                    id: step.id,
                    status: mapSubagentStepStatus(step.status),
                    content: (
                      <>
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                          <span className={failed ? "text-ctp-red" : "text-app-foreground"}>
                            {line.title}
                          </span>
                          {line.subject ? (
                            <span className="min-w-0 wrap-break-word text-ctp-subtext0">
                              {line.subject}
                            </span>
                          ) : null}
                          {line.outcome ? (
                            <span className={failed ? "text-ctp-red" : "text-ctp-overlay0"}>
                              {line.outcome}
                            </span>
                          ) : running ? (
                            <span className="text-ctp-overlay0">进行中</span>
                          ) : null}
                        </div>
                        {step.errorMessage ? (
                          <p className="mt-0.5 text-2xs text-ctp-red">{step.errorMessage}</p>
                        ) : null}
                      </>
                    ),
                  };
                })}
              />
            ) : (
              <p className="text-ctp-subtext0">{model.isLive ? "启动中…" : "无步骤记录"}</p>
            )}
          </ClippedLivePanel>

          {model.report ? (
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                className="group/disclosure-row flex w-full items-center gap-1 text-left text-2xs text-ctp-overlay0 outline-none"
                onClick={() => {
                  setReportOpen((value) => !value);
                }}
              >
                <span>报告</span>
                <HoverRevealChevron expanded={reportOpen} forceVisible={reportOpen} />
              </button>
              <p
                className={cn(
                  "min-w-0 wrap-break-word whitespace-pre-wrap text-app-foreground",
                  !reportOpen && "line-clamp-1",
                )}
              >
                {model.report}
              </p>
            </div>
          ) : null}

          {model.error && toolCall.status !== "error" ? (
            <p className={toolCallErrorMessageClass}>{model.error}</p>
          ) : null}

          {model.isError
            ? maybeErrorTechnicalFields(toolCall.status, [
                model.agentId ? { label: "Agent ID", value: model.agentId } : null,
                model.runStatus ? { label: "状态码", value: model.runStatus } : null,
              ])
            : null}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
