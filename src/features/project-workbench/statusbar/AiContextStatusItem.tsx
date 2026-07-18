import { useEffect, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type { AiChatSelectableModel } from "#shared/rpc/ai/index";
import {
  useAiChatActions,
  useAiChatStatusMeta,
} from "#workbench/auxiliary/ai-chat/state/use-ai-chat-state";
import {
  describeContextUsageRatio,
  resolveLatestLastInputTokens,
} from "#workbench/auxiliary/ai-chat/ui/ai-chat-helpers";
import { StatusBarItemInfo } from "#workbench/chrome";

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
  const latestMessage = meta.messages.at(-1);
  const pendingTool =
    latestMessage?.role === "assistant" &&
    latestMessage.parts.some(
      (part) =>
        part.type === "tool_call" && (part.status === "running" || part.status === "awaiting_user"),
    );

  const label = meta.loading
    ? "AI 连接中"
    : meta.subscriptionError || meta.errorMessage
      ? "AI 请求失败"
      : meta.pendingUserInputCount > 0
        ? "AI 等待输入"
        : pendingTool
          ? "AI 执行工具"
          : meta.pending
            ? "AI 正在生成"
            : usage
              ? `AI ${usage.label}`
              : "AI 就绪";
  const title = usage
    ? `${selectedModel?.name ?? meta.model} · 上下文 ${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()} token（${usage.percent}%）`
    : (selectedModel?.name ?? meta.model);

  return (
    <StatusBarItemInfo
      className={cn(
        "gap-1",
        usage?.toneClass,
        (meta.subscriptionError || meta.errorMessage) && "text-ctp-red",
      )}
      numeric={usage !== null}
      title={title}
    >
      <span aria-hidden="true" className="icon-[codicon--sparkle]" />
      {label}
    </StatusBarItemInfo>
  );
}
