import type { AiChatToolCall, AiToolView } from "#shared/rpc/ai/index";

import {
  ActivityPathList,
  DetailField,
  DetailList,
  maybeErrorTechnicalFields,
  SnippetPreview,
} from "./presenter-detail";
import { toolActionLabel, toolIcon } from "./presenter-format";
import type { ToolPresentation } from "./presenter-types";
import { runSubagentPresenter } from "./presenters-interaction";

export type ResolvedToolPresentation = ToolPresentation & { icon: string };

function mutationIndicator(
  actionLabel: string,
  status: AiChatToolCall["status"],
): string | undefined {
  if (status !== "complete") return undefined;
  if (actionLabel.includes("删除")) return "已删除";
  if (actionLabel.includes("重命名")) return "已重命名";
  if (actionLabel.includes("移动")) return "已移动";
  if (actionLabel.includes("文件夹")) return "已创建";
  return "完成";
}

function presentFromView(toolCall: AiChatToolCall, view: AiToolView): ToolPresentation {
  switch (view.kind) {
    case "subagent":
      // Dedicated presenter owns timeline + report layout.
      return runSubagentPresenter(toolCall);

    case "search":
      return {
        icon: toolIcon("search_documents"),
        label: toolActionLabel("search_documents"),
        summary: `“${view.query}”${view.isRegex ? " · 正则" : ""}`,
        indicator:
          toolCall.status === "complete" || view.hits.length > 0
            ? `${view.hitCount} 处命中`
            : undefined,
        detail:
          toolCall.status === "complete" || toolCall.status === "error" || view.hits.length > 0 ? (
            <>
              <DetailList>
                <DetailField label="范围">{view.scopeLabel}</DetailField>
                <DetailField label="命中">
                  {view.hits.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {view.hits.slice(0, 8).map((hit, index) => (
                        <li key={`${hit.path}:${hit.line ?? ""}:${index}`} className="min-w-0">
                          <p className="wrap-break-word text-app-foreground">
                            {hit.line ? `${hit.path}:${hit.line}` : hit.path}
                          </p>
                          {hit.snippet ? (
                            <p className="text-2xs wrap-break-word text-ctp-subtext0">
                              {hit.snippet}
                            </p>
                          ) : null}
                        </li>
                      ))}
                      {view.hits.length > 8 ? (
                        <li className="text-ctp-subtext0">另有 {view.hits.length - 8} 项</li>
                      ) : null}
                    </ul>
                  ) : (
                    "无"
                  )}
                </DetailField>
              </DetailList>
              {maybeErrorTechnicalFields(toolCall.status, [{ label: "关键词", value: view.query }])}
            </>
          ) : null,
      };

    case "read":
      return {
        icon: toolIcon("read_document"),
        label: toolActionLabel("read_document"),
        summary: `${view.domainLabel} · ${view.documentName}`,
        indicator: view.scale ?? undefined,
        detail:
          toolCall.status === "error"
            ? maybeErrorTechnicalFields(toolCall.status, [
                { label: "文档", value: view.documentName },
              ])
            : null,
      };

    case "structure":
      return {
        icon: toolIcon("read_structure"),
        label: toolActionLabel("read_structure"),
        summary: view.scopeLabel,
        indicator:
          toolCall.status === "complete" || view.nodeCount > 0
            ? `${view.nodeCount} 个节点`
            : undefined,
        detail:
          toolCall.status === "complete" || toolCall.status === "error" ? (
            <>
              <DetailList>
                <DetailField label="范围">{view.scopeLabel}</DetailField>
                <DetailField label="节点数">{view.nodeCount}</DetailField>
                {view.textNodeCount != null && view.textCharTotal != null ? (
                  <DetailField label="可见正文">
                    {view.textNodeCount} 个节点 · {view.textCharTotal} 字符
                  </DetailField>
                ) : null}
                {view.collapsedCount != null ? (
                  <DetailField label="待展开目录">{view.collapsedCount}</DetailField>
                ) : null}
              </DetailList>
              {maybeErrorTechnicalFields(toolCall.status, [])}
            </>
          ) : null,
      };

    case "write": {
      const label =
        view.mode === "delete-span"
          ? "删除片段"
          : view.mode === "create"
            ? toolActionLabel("create_document")
            : view.mode === "replace"
              ? toolActionLabel("replace_document_text")
              : toolActionLabel("write_document");
      const indicator =
        view.delta ??
        view.nextScale ??
        (toolCall.status === "complete"
          ? view.mode === "delete-span"
            ? "已删除"
            : view.mode === "create"
              ? "已创建"
              : undefined
          : undefined);
      const hasFacts =
        view.previousScale != null ||
        view.nextScale != null ||
        view.delta != null ||
        (view.previews?.length ?? 0) > 0;
      return {
        icon: toolIcon(
          view.mode === "replace" || view.mode === "delete-span"
            ? "replace_document_text"
            : view.mode === "create"
              ? "create_document"
              : "write_document",
        ),
        label,
        summary: `${view.domainLabel} · ${view.documentName}`,
        indicator,
        detail:
          hasFacts || toolCall.status === "error" ? (
            <>
              {hasFacts ? (
                <div className="flex flex-col gap-1.5">
                  <DetailList>
                    {view.previousScale != null ? (
                      <DetailField label="原正文">{view.previousScale}</DetailField>
                    ) : null}
                    {view.nextScale != null ? (
                      <DetailField label={view.mode === "create" ? "初始正文" : "新正文"}>
                        {view.nextScale}
                      </DetailField>
                    ) : null}
                    {view.delta != null ? (
                      <DetailField label="变更量">{view.delta}</DetailField>
                    ) : null}
                    {view.mode === "delete-span" ? (
                      <DetailField label="操作">删除匹配片段</DetailField>
                    ) : null}
                  </DetailList>
                  {view.previews?.map((preview) => (
                    <SnippetPreview key={preview.label} label={preview.label} text={preview.text} />
                  ))}
                </div>
              ) : null}
              {maybeErrorTechnicalFields(toolCall.status, [
                { label: "文档", value: view.documentName },
              ])}
            </>
          ) : null,
      };
    }

    case "mutation":
      return {
        icon: toolIcon(
          view.actionLabel.includes("删除")
            ? "delete_node"
            : view.actionLabel.includes("重命名")
              ? "rename_node"
              : view.actionLabel.includes("移动")
                ? "move_node"
                : "create_folder",
        ),
        label: view.actionLabel,
        summary: `${view.domainLabel} · ${view.display}`,
        indicator: mutationIndicator(view.actionLabel, toolCall.status),
        detail:
          toolCall.status === "error"
            ? maybeErrorTechnicalFields(toolCall.status, [{ label: "目标", value: view.display }])
            : null,
      };

    case "changes":
      return {
        icon: toolIcon("read_changes"),
        label: toolActionLabel("read_changes"),
        summary: view.scopeLabel,
        indicator:
          toolCall.status === "complete" || view.count > 0 ? `${view.count} 项` : undefined,
        detail:
          toolCall.status === "complete" || toolCall.status === "error" ? (
            <>
              {view.paths.length > 0 ? (
                <ActivityPathList items={view.paths} emptyLabel="无变更" />
              ) : (
                <p className="text-ctp-subtext0">无变更</p>
              )}
              {maybeErrorTechnicalFields(toolCall.status, [
                { label: "范围", value: view.scopeLabel },
              ])}
            </>
          ) : null,
      };

    case "change":
      return {
        icon: toolIcon("read_change"),
        label: toolActionLabel("read_change"),
        summary: `${view.domainLabel} · ${view.documentName}`,
        indicator: view.currentScale ?? view.originalScale ?? undefined,
        detail:
          view.originalScale != null || view.currentScale != null || toolCall.status === "error" ? (
            <>
              <DetailList>
                {view.originalScale != null ? (
                  <DetailField label="原正文">{view.originalScale}</DetailField>
                ) : null}
                {view.currentScale != null ? (
                  <DetailField label="当前正文">{view.currentScale}</DetailField>
                ) : null}
              </DetailList>
              {maybeErrorTechnicalFields(toolCall.status, [
                { label: "文档", value: view.documentName },
              ])}
            </>
          ) : null,
      };

    case "history":
      return {
        icon: toolIcon("read_history"),
        label: toolActionLabel("read_history"),
        summary: `${view.domainLabel} · ${view.documentName}`,
        indicator:
          toolCall.status === "complete" || view.entryCount > 0
            ? `${view.entryCount} 条`
            : undefined,
        detail:
          toolCall.status === "error"
            ? maybeErrorTechnicalFields(toolCall.status, [
                { label: "文档", value: view.documentName },
              ])
            : null,
      };

    case "history_entry":
      return {
        icon: toolIcon("read_history_entry"),
        label: toolActionLabel("read_history_entry"),
        summary: `${view.domainLabel} · ${view.documentName}`,
        indicator: view.contentScale ?? undefined,
        detail:
          view.contentScale != null || view.beforeScale != null || toolCall.status === "error" ? (
            <>
              <DetailList>
                {view.contentScale != null ? (
                  <DetailField label="历史正文">{view.contentScale}</DetailField>
                ) : null}
                {view.beforeScale != null ? (
                  <DetailField label="此前正文">{view.beforeScale}</DetailField>
                ) : null}
              </DetailList>
              {maybeErrorTechnicalFields(toolCall.status, [
                { label: "文档", value: view.documentName },
              ])}
            </>
          ) : null,
      };

    case "ask_user": {
      const selected = view.choices?.find((choice) => choice.title === view.answer);
      const showChoices = !view.answer && (view.choices?.length ?? 0) > 0;
      return {
        icon: toolIcon("ask_user"),
        label: toolActionLabel("ask_user"),
        summary: view.question.length > 64 ? `${view.question.slice(0, 64)}…` : view.question,
        indicator:
          toolCall.status === "complete"
            ? "已回答"
            : toolCall.status === "awaiting_user"
              ? "等待回答"
              : undefined,
        detail: (
          <>
            <DetailList>
              <DetailField label="问题">{view.question}</DetailField>
              {view.context ? <DetailField label="说明">{view.context}</DetailField> : null}
              {showChoices ? (
                <DetailField label="选项">
                  <ul className="flex flex-col gap-1">
                    {view.choices!.map((choice) => (
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
              {view.answer ? (
                <DetailField label={selected ? "已选" : "回答"}>
                  {selected ? (
                    <>
                      {selected.title}
                      {selected.description ? (
                        <span className="text-ctp-subtext0"> — {selected.description}</span>
                      ) : null}
                    </>
                  ) : (
                    view.answer
                  )}
                </DetailField>
              ) : null}
            </DetailList>
            {maybeErrorTechnicalFields(toolCall.status, [{ label: "工具", value: "ask_user" }])}
          </>
        ),
      };
    }

    case "generic":
      return {
        icon: toolIcon(toolCall.name),
        label: view.label,
        summary: view.subject,
        indicator: view.outcome ?? undefined,
        detail:
          (view.detailLines && view.detailLines.length > 0) || toolCall.status === "error" ? (
            <>
              {view.detailLines && view.detailLines.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {view.detailLines.map((line, index) => (
                    <li key={`${line}:${index}`} className="wrap-break-word">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
              {maybeErrorTechnicalFields(toolCall.status, [
                { label: "工具", value: toolCall.name },
              ])}
            </>
          ) : null,
      };
  }
}

export function presentToolCall(toolCall: AiChatToolCall): ResolvedToolPresentation {
  if (toolCall.view) {
    const presentation = presentFromView(toolCall, toolCall.view);
    return {
      ...presentation,
      icon: presentation.icon ?? toolIcon(toolCall.name),
    };
  }

  // Fallback for legacy / incomplete rows without a projected view.
  if (toolCall.name === "run_subagent") {
    const presentation = runSubagentPresenter(toolCall);
    return {
      ...presentation,
      icon: presentation.icon ?? toolIcon(toolCall.name),
    };
  }

  return {
    icon: toolIcon(toolCall.name),
    label: toolActionLabel(toolCall.name),
    summary: "已执行",
    detail:
      toolCall.status === "error" ? (
        <p className="text-ctp-subtext0">工具标识：{toolCall.name}</p>
      ) : null,
  };
}
