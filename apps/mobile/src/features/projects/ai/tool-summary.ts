import type { AiChatToolCall, AiToolView } from "@novelevolver/domain/ai";

const TOOL_STATUS_LABEL: Record<AiChatToolCall["status"], string> = {
  pending: "等待",
  running: "运行中",
  awaiting_user: "等待用户",
  complete: "完成",
  error: "失败",
};

function summarizeView(view: AiToolView): string {
  switch (view.kind) {
    case "subagent": {
      const steps = view.steps
        .map((step) => {
          const bits = [step.name, step.subject, step.outcome, step.errorMessage].filter(
            (part) => part != null && part !== "",
          );
          return `- ${bits.join(" · ")}`;
        })
        .join("\n");
      const header = `${view.agentName} · ${view.phase} · ${view.round}/${view.maxRounds}`;
      const report = view.report ? `\n${view.report}` : "";
      return steps === "" ? `${header}${report}` : `${header}\n${steps}${report}`;
    }
    case "search":
      return `“${view.query}” · ${view.scopeLabel} · ${view.hitCount} 处命中`;
    case "read":
      return `${view.domainLabel} ${view.documentName}${view.scale ? ` · ${view.scale}` : ""}`;
    case "structure":
      return `${view.scopeLabel} · ${view.nodeCount} 个节点`;
    case "write":
      return `${view.domainLabel} ${view.documentName} · ${view.mode}${view.delta ? ` · ${view.delta}` : ""}`;
    case "mutation":
      return `${view.actionLabel} · ${view.display}`;
    case "changes":
      return `${view.scopeLabel} · ${view.count} 项`;
    case "change":
      return `${view.domainLabel} ${view.documentName}`;
    case "history":
      return `${view.domainLabel} ${view.documentName} · ${view.entryCount} 条`;
    case "history_entry":
      return `${view.domainLabel} ${view.documentName}`;
    case "ask_user":
      return view.answer ? `${view.question}\n${view.answer}` : view.question;
    case "generic":
      return [view.label, view.subject, view.outcome].filter(Boolean).join(" · ");
  }
}

export function formatToolCall(part: AiChatToolCall): string {
  const status = TOOL_STATUS_LABEL[part.status];
  const view = part.view ? summarizeView(part.view) : part.argumentsText;
  const error = part.errorMessage ? `\n${part.errorMessage}` : "";
  return `${part.name} · ${status}${view ? `\n${view}` : ""}${error}`;
}
