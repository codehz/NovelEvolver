import { parseAskUserToolArguments } from "./ask-user-prompt";
import { DetailField, DetailList } from "./presenter-detail";
import { domainLabel } from "./presenter-format";
import { getObject, getString, parseObject } from "./presenter-parse";
import type { ToolPresenter } from "./presenter-types";
import {
  describeSubagentProgressIndicator,
  parseSubagentProgressUi,
  subagentPhaseLabel,
} from "./subagent-progress-ui";

export const askUserPresenter: ToolPresenter = (toolCall) => {
  const args = parseAskUserToolArguments(toolCall.argumentsText);
  const question = args?.question ?? "等待补充信息";
  const answer = getString(parseObject(toolCall.resultText), "answer");
  const selectedChoice = args?.choices?.find((choice) => choice.title === answer);
  return {
    label: "询问用户",
    summary: question,
    indicator: toolCall.status === "complete" ? "已选择" : undefined,
    detail: args ? (
      <DetailList>
        <DetailField label="问题">{question}</DetailField>
        {args.context ? <DetailField label="说明">{args.context}</DetailField> : null}
        {args.placeholder ? <DetailField label="输入提示">{args.placeholder}</DetailField> : null}
        {args.choices?.length ? (
          <DetailField label="建议选项">
            <ul className="flex flex-col gap-1">
              {args.choices.map((choice) => (
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
          <DetailField label={selectedChoice ? "已选选项" : "用户输入"}>
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
    ) : null,
  };
};

export const runSubagentPresenter: ToolPresenter = (toolCall) => {
  const args = parseObject(toolCall.argumentsText);
  const result =
    toolCall.status === "complete" || toolCall.status === "error"
      ? parseObject(toolCall.resultText)
      : null;
  // Live progress is only meaningful while running; ignore stale payloads after completion.
  const progress =
    toolCall.status === "running" ? parseSubagentProgressUi(toolCall.progressText) : null;
  const agentId =
    getString(result, "agent_id") ??
    progress?.agentId ??
    getString(args, "agent_id") ??
    "未知 Agent";
  const agentName = getString(result, "agent_name") ?? progress?.agentName ?? null;
  const task = getString(args, "task") ?? "未指定任务";
  const taskPreview = task.length > 48 ? `${task.slice(0, 48)}…` : task;
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
  const agentLabel = agentName ? `${agentName}` : agentId;
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
        ? "执行中"
        : toolCall.status === "error"
          ? "错误"
          : undefined;

  return {
    label: "委派子代理",
    summary: `${agentLabel} · ${taskPreview}`,
    indicator: statusLabel ?? liveIndicator,
    detail: (
      <DetailList>
        <DetailField label="Agent">{agentLabel}</DetailField>
        <DetailField label="Agent ID">{agentId}</DetailField>
        <DetailField label="任务">{task}</DetailField>
        {constraints ? <DetailField label="约束">{constraints}</DetailField> : null}
        {focus.length > 0 ? (
          <DetailField label="焦点节点">
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
                {progress.currentTool.name}
                {progress.currentTool.status === "running" ? " · 执行中" : null}
              </DetailField>
            ) : null}
            {progress.recentTools.length > 0 ? (
              <DetailField label="最近工具">
                <ul className="flex flex-col gap-1">
                  {progress.recentTools.map((tool, index) => (
                    <li key={`${tool.name}:${index}`}>
                      {tool.name}
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
        {statusLabel ? <DetailField label="结果状态">{statusLabel}</DetailField> : null}
        {wrote !== null ? (
          <DetailField label="是否写回">{wrote ? "已写入工作区" : "只读"}</DetailField>
        ) : null}
        {touched.length > 0 ? (
          <DetailField label="触及节点">{touched.join(", ")}</DetailField>
        ) : progress && progress.touchedCount > 0 ? (
          <DetailField label="触及节点">{`${progress.touchedCount} 个`}</DetailField>
        ) : null}
        {summary ? <DetailField label="摘要">{summary}</DetailField> : null}
        {error ? <DetailField label="错误">{error}</DetailField> : null}
      </DetailList>
    ),
  };
};
