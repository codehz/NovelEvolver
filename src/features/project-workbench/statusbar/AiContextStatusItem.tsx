import { useEffect, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type { AiChatSelectableModel } from "#shared/rpc/ai/index";
import { StatusBarItemInfo } from "#workbench/chrome";

import { useAiChatState } from "../auxiliary/ai-chat/state/use-ai-chat-state";
import {
  describeContextUsageRatio,
  resolveLatestLastInputTokens,
} from "../auxiliary/ai-chat/ui/ai-chat-ui";

export function AiContextStatusItem() {
  const { snapshot, loading, subscriptionError, listSelectableModels } = useAiChatState();
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
  }, [listSelectableModels, snapshot.selectedModelId]);

  const selectedModel = models.find((model) => model.id === snapshot.selectedModelId) ?? null;
  const usage = describeContextUsageRatio(
    selectedModel?.contextLength,
    resolveLatestLastInputTokens(snapshot.messages),
  );
  const latestMessage = snapshot.messages.at(-1);
  const pendingTool =
    latestMessage?.role === "assistant" &&
    latestMessage.parts.some(
      (part) =>
        part.type === "tool_call" && (part.status === "running" || part.status === "awaiting_user"),
    );

  const label = loading
    ? "AI 连接中"
    : subscriptionError || snapshot.errorMessage
      ? "AI 请求失败"
      : snapshot.pendingUserInputs.length > 0
        ? "AI 等待输入"
        : pendingTool
          ? "AI 执行工具"
          : snapshot.pending
            ? "AI 正在生成"
            : usage
              ? `AI ${usage.label}`
              : "AI 就绪";
  const title = usage
    ? `${selectedModel?.name ?? snapshot.model} · 上下文 ${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()} token（${usage.percent}%）`
    : (selectedModel?.name ?? snapshot.model);

  return (
    <StatusBarItemInfo
      className={cn(
        "gap-1",
        usage?.toneClass,
        (subscriptionError || snapshot.errorMessage) && "text-ctp-red",
      )}
      numeric={usage !== null}
      title={title}
    >
      <span aria-hidden="true" className="icon-[codicon--sparkle]" />
      {label}
    </StatusBarItemInfo>
  );
}
