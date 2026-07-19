import { parseAskUserToolArguments } from "./ask-user-prompt";
import { DetailField, DetailList, ErrorTechnicalFields } from "./presenter-detail";
import { domainLabel, toolActionLabel, toolIcon, truncateText } from "./presenter-format";
import { getObject, getString, parseObject } from "./presenter-parse";
import type { TechnicalField, ToolPresenter } from "./presenter-types";
import {
  describeSubagentProgressIndicator,
  parseSubagentProgressUi,
  subagentPhaseLabel,
} from "./subagent-progress-ui";

function techFields(fields: Array<TechnicalField | null | false | undefined>): TechnicalField[] {
  return fields.filter((field): field is TechnicalField => Boolean(field));
}

function maybeErrorTech(status: string, fields: Array<TechnicalField | null | false | undefined>) {
  if (status !== "error") {
    return null;
  }
  const list = techFields(fields);
  return list.length > 0 ? <ErrorTechnicalFields fields={list} /> : null;
}

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
    summary: truncateText(question, 64),
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
        {isError ? maybeErrorTech(toolCall.status, [{ label: "工具", value: "ask_user" }]) : null}
      </>
    ) : isError ? (
      maybeErrorTech(toolCall.status, [{ label: "工具", value: "ask_user" }])
    ) : null,
  };
};

export const runSubagentPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result =
    toolCall.status === "complete" || toolCall.status === "error"
      ? parseObject(toolCall.resultText)
      : null;
  const progress =
    toolCall.status === "running" ? parseSubagentProgressUi(toolCall.progressText) : null;
  const agentId =
    getString(result, "agent_id") ??
    progress?.agentId ??
    getString(args, "agent_id") ??
    "未知 Agent";
  const agentName = getString(result, "agent_name") ?? progress?.agentName ?? null;
  const task = getString(args, "task") ?? "未指定任务";
  const taskPreview = truncateText(task, 48);
  const status = getString(result, "status");
  const summary = getString(result, "summary");
  const error = getString(result, "error") ?? toolCall.errorMessage;
  const artifacts = getObject(result?.artifacts);
  const wrote =
    typeof artifacts?.wrote === "boolean" ? artifacts.wrote : progress ? progress.wrote : null;
  const touched = Array.isArray(artifacts?.touched_node_ids)
    ? artifacts.touched_node_ids.filter((id): id is string => typeof id === "string")
    : [];
  const focus = Array.isArray(args?.focus) ? args.focus : [];
  const constraints = getString(args, "constraints");
  const agentLabel = agentName ?? agentId;
  const statusLabel =
    status === "completed"
      ? "完成"
      : status === "failed"
        ? "失败"
        : status === "aborted"
          ? "已中止"
          : status === "needs_user"
            ? "需用户"
            : null;
  const liveIndicator =
    progress != null
      ? describeSubagentProgressIndicator(progress)
      : toolCall.status === "running"
        ? "进行中"
        : toolCall.status === "error"
          ? "失败"
          : undefined;
  const isError = toolCall.status === "error" || status === "failed";
  const hasExpandBody =
    Boolean(task) ||
    Boolean(constraints) ||
    Boolean(progress) ||
    Boolean(statusLabel) ||
    wrote !== null ||
    touched.length > 0 ||
    Boolean(summary) ||
    Boolean(error) ||
    isError;

  return {
    icon: toolIcon("run_subagent"),
    label: toolActionLabel("run_subagent"),
    summary: `${agentLabel} · ${taskPreview}`,
    indicator: statusLabel ?? liveIndicator,
    detail: hasExpandBody ? (
      <>
        <DetailList>
          <DetailField label="Agent">{agentLabel}</DetailField>
          <DetailField label="任务">{task}</DetailField>
          {constraints ? <DetailField label="约束">{constraints}</DetailField> : null}
          {focus.length > 0 && toolCall.status === "running" ? (
            <DetailField label="焦点">
              <ul className="flex flex-col gap-1">
                {focus.slice(0, 8).map((entry, index) => {
                  const item = getObject(entry);
                  const domain = getString(item, "domain") ?? "?";
                  const id = getString(item, "id") ?? "?";
                  return (
                    <li key={`${domain}:${id}:${index}`}>
                      {domainLabel(domain)} · {id}
                    </li>
                  );
                })}
                {focus.length > 8 ? (
                  <li className="text-ctp-subtext0">另有 {focus.length - 8} 个</li>
                ) : null}
              </ul>
            </DetailField>
          ) : null}
          {progress ? (
            <>
              <DetailField label="阶段">{subagentPhaseLabel(progress.phase)}</DetailField>
              {progress.round > 0 ? (
                <DetailField label="模型轮次">
                  第 {progress.round} / {progress.maxRounds} 轮
                </DetailField>
              ) : null}
              {progress.currentTool ? (
                <DetailField label="当前工具">
                  {toolActionLabel(progress.currentTool.name)}
                  {progress.currentTool.status === "running" ? " · 进行中" : null}
                </DetailField>
              ) : null}
              {progress.recentTools.length > 0 ? (
                <DetailField label="最近工具">
                  <ul className="flex flex-col gap-1">
                    {progress.recentTools.map((tool, index) => (
                      <li key={`${tool.name}:${index}`}>
                        {toolActionLabel(tool.name)}
                        {tool.status === "error"
                          ? " · 失败"
                          : tool.status === "complete"
                            ? " · 完成"
                            : ""}
                      </li>
                    ))}
                  </ul>
                </DetailField>
              ) : null}
              {progress.partialSummary ? (
                <DetailField label="进行中摘要">{progress.partialSummary}</DetailField>
              ) : null}
            </>
          ) : null}
          {statusLabel ? <DetailField label="结果">{statusLabel}</DetailField> : null}
          {wrote !== null ? (
            <DetailField label="写回">{wrote ? "已写入工作区" : "只读"}</DetailField>
          ) : null}
          {touched.length > 0 ? (
            <DetailField label="触及节点">{`${touched.length} 个`}</DetailField>
          ) : progress && progress.touchedCount > 0 ? (
            <DetailField label="触及节点">{`${progress.touchedCount} 个`}</DetailField>
          ) : null}
          {summary ? <DetailField label="摘要">{summary}</DetailField> : null}
          {error && toolCall.status !== "error" ? (
            <DetailField label="错误">{error}</DetailField>
          ) : null}
        </DetailList>
        {maybeErrorTech(toolCall.status, [
          agentId ? { label: "Agent ID", value: agentId } : null,
          status ? { label: "状态码", value: status } : null,
        ])}
      </>
    ) : null,
  };
};
