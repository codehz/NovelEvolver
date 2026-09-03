import type { AiChatToolCall, AiToolView, AssistantWorkStep } from "@novelevolver/domain/ai";

export type MobileToolIcon =
  | "comment-discussion"
  | "diff"
  | "edit"
  | "eye"
  | "history"
  | "list-tree"
  | "search"
  | "sparkle"
  | "symbol-event"
  | "tools";

export type MobileToolPresentation = {
  icon: MobileToolIcon;
  label: string;
  subject: string;
  indicator?: string;
  detail: string[];
};

const statusLabel: Record<AiChatToolCall["status"], string> = {
  pending: "准备中",
  running: "进行中",
  awaiting_user: "等待回答",
  complete: "完成",
  error: "失败",
};

function viewPresentation(view: AiToolView): Omit<MobileToolPresentation, "indicator"> {
  switch (view.kind) {
    case "search":
      return {
        icon: "search",
        label: "搜索",
        subject: `“${view.query}”`,
        detail: [
          `范围：${view.scopeLabel}`,
          `命中：${view.hitCount} 处`,
          ...view.hits
            .slice(0, 8)
            .map(
              (hit) =>
                `${hit.path}${hit.line == null ? "" : `:${hit.line}`} · ${hit.snippet ?? ""}`,
            ),
        ],
      };
    case "read":
      return {
        icon: "eye",
        label: "读取",
        subject: `${view.domainLabel} · ${view.documentName}`,
        detail: view.scale ? [`规模：${view.scale}`] : [],
      };
    case "structure":
      return {
        icon: "list-tree",
        label: "读取目录",
        subject: view.scopeLabel,
        detail: [
          `节点：${view.nodeCount}`,
          ...(view.textNodeCount != null && view.textCharTotal != null
            ? [`正文：${view.textNodeCount} 个节点 · ${view.textCharTotal} 字符`]
            : []),
        ],
      };
    case "write":
      return {
        icon: "edit",
        label: view.mode === "create" ? "创建" : "写入",
        subject: `${view.domainLabel} · ${view.documentName}`,
        detail: [
          view.previousScale ? `原正文：${view.previousScale}` : "",
          view.nextScale ? `新正文：${view.nextScale}` : "",
          view.delta ? `变更量：${view.delta}` : "",
          ...(view.previews ?? []).map((preview) => `${preview.label}：${preview.text}`),
        ].filter(Boolean),
      };
    case "mutation":
      return {
        icon: "symbol-event",
        label: view.actionLabel,
        subject: `${view.domainLabel} · ${view.display}`,
        detail: view.previousDisplay ? [`此前：${view.previousDisplay}`] : [],
      };
    case "changes":
      return {
        icon: "diff",
        label: "读取变更",
        subject: view.scopeLabel,
        detail: [`数量：${view.count}`, ...view.paths.slice(0, 12)],
      };
    case "change":
      return {
        icon: "diff",
        label: "读取变更",
        subject: `${view.domainLabel} · ${view.documentName}`,
        detail: [
          view.originalScale ? `原正文：${view.originalScale}` : "",
          view.currentScale ? `当前正文：${view.currentScale}` : "",
        ].filter(Boolean),
      };
    case "history":
      return {
        icon: "history",
        label: "读取历史",
        subject: `${view.domainLabel} · ${view.documentName}`,
        detail: [`记录：${view.entryCount} 条`],
      };
    case "history_entry":
      return {
        icon: "history",
        label: "读取历史记录",
        subject: `${view.domainLabel} · ${view.documentName}`,
        detail: [
          view.contentScale ? `正文：${view.contentScale}` : "",
          view.beforeScale ? `此前：${view.beforeScale}` : "",
        ].filter(Boolean),
      };
    case "ask_user":
      return {
        icon: "comment-discussion",
        label: "询问用户",
        subject: view.question,
        detail: [
          view.question,
          ...(view.context ? [`说明：${view.context}`] : []),
          ...(view.choices ?? []).map(
            (choice) =>
              `选项：${choice.title}${choice.description ? ` — ${choice.description}` : ""}`,
          ),
          ...(view.answer ? [`回答：${view.answer}`] : []),
        ],
      };
    case "subagent":
      return {
        icon: "sparkle",
        label: "子代理",
        subject: `${view.agentName} · ${view.phase}`,
        detail: [
          `任务：${view.task}`,
          ...(view.constraints ? [`约束：${view.constraints}`] : []),
          `轮次：${view.round}/${view.maxRounds}`,
          ...view.steps.map(
            (step) =>
              `${step.name}${step.subject ? ` · ${step.subject}` : ""}${step.outcome ? ` · ${step.outcome}` : ""}`,
          ),
          ...(view.report ? [`报告：${view.report}`] : []),
        ],
      };
    case "generic":
      return {
        icon: "tools",
        label: view.label,
        subject: view.subject,
        detail: view.detailLines ?? [],
      };
  }
}

export function presentMobileToolCall(part: AiChatToolCall): MobileToolPresentation {
  const base: Omit<MobileToolPresentation, "indicator"> = part.view
    ? viewPresentation(part.view)
    : { icon: "tools", label: part.name, subject: part.argumentsText, detail: [] };
  return {
    ...base,
    indicator:
      part.status === "complete"
        ? base.detail.length > 0
          ? "完成"
          : undefined
        : statusLabel[part.status],
    detail: part.errorMessage ? [...base.detail, `错误：${part.errorMessage}`] : base.detail,
  };
}

export function describeMobileWork(steps: readonly AssistantWorkStep[]): string {
  const live = steps.some((step) =>
    step.type === "reasoning"
      ? step.status === "streaming"
      : step.status === "pending" || step.status === "running" || step.status === "awaiting_user",
  );
  if (live) {
    const current = [...steps]
      .reverse()
      .find(
        (step) =>
          step.type === "tool_call" && (step.status === "pending" || step.status === "running"),
      );
    return current?.type === "tool_call" ? presentMobileToolCall(current).label : "进行中";
  }
  const errors = steps.filter(
    (step) => step.type === "tool_call" && step.status === "error",
  ).length;
  return `已完成 ${steps.length} 个步骤${errors > 0 ? ` · ${errors} 失败` : ""}`;
}
