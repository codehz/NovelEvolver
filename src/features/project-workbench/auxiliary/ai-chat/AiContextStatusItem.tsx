import { useEffect, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type { AiChatMessage, AiChatSelectableModel } from "#shared/rpc/ai/index";
import { StatusBarItemInfo } from "#workbench/chrome";

import { useAiChatActions, useAiChatStatusMeta } from "./state/use-ai-chat-state";
import {
  describeRunningSubagentStatus,
  progressUiFromToolView,
} from "./tools/subagent-progress-ui";
import {
  describeContextUsageRatio,
  findRunningSubagentToolCall,
  resolveLatestLastInputTokens,
  type ContextUsageRatio,
} from "./ui/ai-chat-helpers";

type AiStatusActivity = {
  /** Standalone label when usage is absent (e.g. `AI 正在生成`). */
  full: string;
  /** Compact prefix when usage is shown (e.g. `生成中`). */
  short: string;
};

type AiStatusMeta = {
  loading: boolean;
  subscriptionError: string | null;
  pending: boolean;
  openInteractionCount: number;
  errorMessage: string | null;
  messages: readonly AiChatMessage[];
};

function resolveAiStatusActivity(meta: AiStatusMeta): AiStatusActivity | null {
  if (meta.subscriptionError || meta.errorMessage) {
    return { full: "AI 请求失败", short: "请求失败" };
  }
  if (meta.openInteractionCount > 0) {
    return { full: "AI 等待输入", short: "等待输入" };
  }

  const latestMessage = meta.messages.at(-1);
  const runningSubagent =
    latestMessage?.role === "assistant" ? findRunningSubagentToolCall(latestMessage) : null;
  if (runningSubagent) {
    const progress = progressUiFromToolView(runningSubagent.view);
    const label = progress ? describeRunningSubagentStatus(progress) : "子代理进行中";
    return { full: label, short: label };
  }

  const pendingTool =
    latestMessage?.role === "assistant" &&
    latestMessage.parts.some(
      (part) =>
        part.type === "tool_call" && (part.status === "running" || part.status === "awaiting_user"),
    );
  if (pendingTool) {
    return { full: "AI 调用工具中", short: "调用工具" };
  }
  if (meta.pending) {
    return { full: "AI 正在生成", short: "生成中" };
  }
  return null;
}

function composeAiContextStatusLabel(
  loading: boolean,
  activity: AiStatusActivity | null,
  usage: ContextUsageRatio | null,
): string {
  if (loading) {
    return "AI 连接中";
  }
  if (activity && usage) {
    return `${activity.short} · ${usage.label}`;
  }
  if (activity) {
    return activity.full;
  }
  if (usage) {
    return `AI ${usage.label}`;
  }
  return "AI 就绪";
}

function composeAiContextStatusTitle(
  activity: AiStatusActivity | null,
  usage: ContextUsageRatio | null,
  modelName: string,
): string {
  const usageDetail = usage
    ? `上下文 ${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()} token（${usage.percent}%）`
    : null;
  const parts = [activity?.full, modelName, usageDetail].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return parts.join(" · ");
}

export function AiContextStatusItem() {
  const meta = useAiChatStatusMeta();
  const { listSelectableModels } = useAiChatActions();
  const [models, setModels] = useState<AiChatSelectableModel[]>([]);

  useEffect(() => {
    let active = true;
    void listSelectableModels().then((next) => {
      if (active) {
        setModels(next);
      }
    });
    return () => {
      active = false;
    };
  }, [listSelectableModels, meta.selectedModelId]);

  const selectedModel = models.find((model) => model.id === meta.selectedModelId) ?? null;
  const usage = describeContextUsageRatio(
    selectedModel?.contextLength,
    resolveLatestLastInputTokens(meta.messages),
  );
  const failed = meta.subscriptionError != null || meta.errorMessage != null;
  const activity = meta.loading ? null : resolveAiStatusActivity(meta);
  const modelName = selectedModel?.name ?? meta.model;
  const label = composeAiContextStatusLabel(meta.loading, activity, usage);
  const title = composeAiContextStatusTitle(activity, usage, modelName);

  return (
    <StatusBarItemInfo
      className={cn("gap-1", !failed && usage?.toneClass, failed && "text-ctp-red")}
      numeric={usage !== null}
      title={title}
    >
      <span aria-hidden="true" className="icon-[codicon--sparkle]" />
      {label}
    </StatusBarItemInfo>
  );
}
