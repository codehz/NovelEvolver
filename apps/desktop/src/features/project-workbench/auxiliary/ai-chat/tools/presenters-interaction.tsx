import { MarkdownStream } from "#app/shared/ui/MarkdownStream";
import type { AiSubagentToolView } from "#shared/rpc/ai/index";

import { assistantMessageBodyClass } from "../ui/ai-chat-chrome";
import { stripMarkdownPreview } from "../ui/strip-markdown-preview";
import { TimelineRail } from "../ui/TimelineRail";
import { parseAskUserToolArguments } from "./ask-user-prompt";
import { DetailField, DetailList, maybeErrorTechnicalFields } from "./presenter-detail";
import { toolActionLabel, toolIcon, truncateText } from "./presenter-format";
import { getString, parseObject } from "./presenter-parse";
import type { ToolPresenter } from "./presenter-types";
import {
  describeSubagentProgressIndicator,
  progressUiFromToolView,
  readSubagentView,
  subagentPhaseLabel,
} from "./subagent-progress-ui";

export const askUserPresenter: ToolPresenter = (toolCall) => {
  const args = parseAskUserToolArguments(toolCall.argumentsText);
  const question = args?.question ?? "等待补充信息";
  const answer = getString(parseObject(toolCall.resultText), "answer");
  const selectedChoice = args?.choices?.find((choice) => choice.title === answer);
  const isError = toolCall.status === "error";
  const showChoices = !answer && (args?.choices?.length ?? 0) > 0;

  return {
    icon: toolIcon("ask_user"),
    label: toolActionLabel("ask_user"),
    subject: truncateText(question, 64),
    indicator:
      toolCall.status === "complete"
        ? "已回答"
        : toolCall.status === "awaiting_user"
          ? "等待回答"
          : undefined,
    detail: args ? (
      <>
        <DetailList>
          <DetailField label="问题">{question}</DetailField>
          {args.context ? <DetailField label="说明">{args.context}</DetailField> : null}
          {showChoices ? (
            <DetailField label="选项">
              <ul className="flex flex-col gap-1">
                {args.choices!.map((choice) => (
                  <li key={`${choice.title}:${choice.description ?? ""}`}>
                    {choice.title}
                    {choice.description ? (
                      <span className="text-ctp-subtext0"> — {choice.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </DetailField>
          ) : null}
          {answer ? (
            <DetailField label={selectedChoice ? "已选" : "回答"}>
              {selectedChoice ? (
                <>
                  {selectedChoice.title}
                  {selectedChoice.description ? (
                    <span className="text-ctp-subtext0"> — {selectedChoice.description}</span>
                  ) : null}
                </>
              ) : (
                answer
              )}
            </DetailField>
          ) : null}
        </DetailList>
        {isError
          ? maybeErrorTechnicalFields(toolCall.status, [{ label: "工具", value: "ask_user" }])
          : null}
      </>
    ) : isError ? (
      maybeErrorTechnicalFields(toolCall.status, [{ label: "工具", value: "ask_user" }])
    ) : null,
  };
};

function runStatusLabel(status: AiSubagentToolView["runStatus"]): string | null {
  switch (status) {
    case "completed":
      return "完成";
    case "failed":
      return "失败";
    case "aborted":
      return "已中止";
    case "needs_user":
      return "需用户";
    default:
      return null;
  }
}

function SubagentTimeline({ view }: { view: AiSubagentToolView }) {
  if (view.steps.length === 0) {
    return (
      <p className="text-ctp-subtext0">
        {view.phase === "done" ? "未调用子工具" : `${subagentPhaseLabel(view.phase)}…`}
      </p>
    );
  }

  return (
    <TimelineRail
      items={view.steps.map((step) => {
        const running = step.status === "running";
        const failed = step.status === "error";
        return {
          id: step.id,
          status: failed ? "error" : running ? "running" : "complete",
          content: (
            <>
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className={failed ? "text-ctp-red" : "text-app-foreground"}>
                  {toolActionLabel(step.name)}
                </span>
                {step.subject ? (
                  <span className="min-w-0 wrap-break-word text-ctp-subtext0">{step.subject}</span>
                ) : null}
                {step.outcome ? (
                  <span className={failed ? "text-ctp-red" : "text-ctp-overlay0"}>
                    {step.outcome}
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
  );
}

export const runSubagentPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const view = readSubagentView(toolCall.view);
  const progress = progressUiFromToolView(toolCall.view);
  const result =
    toolCall.status === "complete" || toolCall.status === "error"
      ? parseObject(toolCall.resultText)
      : null;

  const agentId =
    view?.agentId ?? getString(result, "agent_id") ?? getString(args, "agent_id") ?? "未知 Agent";
  const agentName = view?.agentName ?? getString(result, "agent_name") ?? null;
  const task =
    (view?.task && view.task !== "" ? view.task : null) ?? getString(args, "task") ?? "未指定任务";
  const taskPreview = truncateText(stripMarkdownPreview(task), 48);
  const constraints = view?.constraints ?? getString(args, "constraints");
  const report =
    view?.report ?? getString(result, "report") ?? getString(result, "summary") ?? null;
  const runStatus =
    view?.runStatus ??
    (getString(result, "status") as AiSubagentToolView["runStatus"] | null) ??
    null;
  const statusLabel = runStatusLabel(runStatus);
  const error = getString(result, "error") ?? toolCall.errorMessage;
  const wrote = view?.artifacts.wrote ?? null;
  const touchedCount = view?.artifacts.touched.length ?? 0;
  const agentLabel = agentName ?? agentId;
  const isError = toolCall.status === "error" || runStatus === "failed";

  const liveIndicator =
    progress != null && toolCall.status === "running"
      ? describeSubagentProgressIndicator(progress)
      : toolCall.status === "running"
        ? "进行中"
        : undefined;

  const hasBody =
    Boolean(view) ||
    Boolean(task) ||
    Boolean(constraints) ||
    Boolean(report) ||
    Boolean(error) ||
    isError;

  return {
    icon: toolIcon("run_subagent"),
    label: toolActionLabel("run_subagent"),
    subject: `${agentLabel} · ${taskPreview}`,
    indicator: statusLabel ?? liveIndicator,
    detail: hasBody ? (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1.5">
          <p className="text-app-foreground">{agentLabel}</p>
          <div className={assistantMessageBodyClass}>
            <MarkdownStream>{task}</MarkdownStream>
          </div>
          {constraints ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-2xs text-ctp-overlay0">约束</span>
              <div className={assistantMessageBodyClass}>
                <MarkdownStream>{constraints}</MarkdownStream>
              </div>
            </div>
          ) : null}
        </div>

        {view ? (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-ctp-overlay0">
              <span>{subagentPhaseLabel(view.phase)}</span>
              {view.round > 0 ? (
                <span>
                  第 {view.round}/{view.maxRounds} 轮
                </span>
              ) : null}
              {wrote !== null ? <span>{wrote ? "已写回" : "只读"}</span> : null}
              {touchedCount > 0 ? <span>触及 {touchedCount} 个节点</span> : null}
            </div>
            <SubagentTimeline view={view} />
          </div>
        ) : null}

        {report ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-2xs text-ctp-overlay0">报告</span>
            <div className={assistantMessageBodyClass}>
              <MarkdownStream>{report}</MarkdownStream>
            </div>
          </div>
        ) : null}

        {error && toolCall.status !== "error" ? <p className="text-ctp-red">{error}</p> : null}

        {isError
          ? maybeErrorTechnicalFields(toolCall.status, [
              agentId ? { label: "Agent ID", value: agentId } : null,
              runStatus ? { label: "状态码", value: runStatus } : null,
            ])
          : null}
      </div>
    ) : null,
  };
};
