import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { Button, AppTooltip } from "#app/shared/ui";
import type { AiChatOpenInteraction } from "#shared/rpc/ai/index";

import { useAiChatActions } from "../state/use-ai-chat-state";
import {
  askUserPanelBodyClass,
  askUserPanelShellClass,
  sendButtonClass,
  stopButtonClass,
} from "../ui/ai-chat-chrome";
import { AskUserQuestionTabs } from "./AskUserQuestionTabs";
import {
  InteractionBody,
  isInteractionDraftReady,
  summarizeInteraction,
} from "./interaction-contributions";

/**
 * 开放交互 shell：多题本地草稿 + 一键提交。
 * 提交走 `submitInteraction`；取消按钮复用中断语义（`stopGeneration`），不继续工具环。
 */
type AskUserComposerPanelProps = {
  loading: boolean;
  openInteractions: AiChatOpenInteraction[];
};

export function AskUserComposerPanel({ loading, openInteractions }: AskUserComposerPanelProps) {
  const { submitInteraction, stopGeneration } = useAiChatActions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftsById, setDraftsById] = useState<Record<string, string>>({});
  const [committing, setCommitting] = useState(false);

  const interactionIds = useMemo(
    () => openInteractions.map((input) => input.id),
    [openInteractions],
  );

  useEffect(() => {
    if (openInteractions.length === 0) {
      setActiveId(null);
      setDraftsById({});
      setCommitting(false);
      return;
    }
    if (activeId === null || !interactionIds.includes(activeId)) {
      setActiveId(interactionIds[0] ?? null);
    }
  }, [activeId, interactionIds, openInteractions]);

  const activeInput =
    activeId === null ? null : (openInteractions.find((input) => input.id === activeId) ?? null);

  const disabled = loading || committing;
  const allReady =
    openInteractions.length > 0 &&
    openInteractions.every((input) => isInteractionDraftReady(input, draftsById[input.id] ?? ""));

  const handleDraftChange = useCallback((id: string, draft: string) => {
    setDraftsById((current) => ({ ...current, [id]: draft }));
  }, []);

  const focusNextIncomplete = useCallback(() => {
    if (openInteractions.length === 0) {
      return;
    }
    const currentIndex = activeId
      ? openInteractions.findIndex((input) => input.id === activeId)
      : -1;
    for (let offset = 1; offset <= openInteractions.length; offset++) {
      const index = (Math.max(currentIndex, 0) + offset) % openInteractions.length;
      const candidate = openInteractions[index]!;
      if (!isInteractionDraftReady(candidate, draftsById[candidate.id] ?? "")) {
        setActiveId(candidate.id);
        return;
      }
    }
  }, [activeId, draftsById, openInteractions]);

  const handleSubmitAll = useCallback(async () => {
    if (disabled || !allReady) {
      return;
    }
    setCommitting(true);
    try {
      for (const input of openInteractions) {
        const draft = (draftsById[input.id] ?? "").trim();
        if (input.kind === "ask_user") {
          await Promise.resolve(submitInteraction(input.id, { kind: "ask_user", text: draft }));
        }
      }
    } finally {
      // openInteractions 清空后由 effect 复位；若仍残留则解锁便于重试。
      setCommitting(false);
    }
  }, [allReady, disabled, draftsById, openInteractions, submitInteraction]);

  /** 中断整轮输出：settle 取消结果并停止，不再继续生成。 */
  const handleCancelAll = useCallback(async () => {
    if (disabled || openInteractions.length === 0) {
      return;
    }
    setCommitting(true);
    try {
      await stopGeneration();
    } finally {
      setCommitting(false);
    }
  }, [disabled, openInteractions.length, stopGeneration]);

  const handleRequestCommit = useCallback(() => {
    if (allReady) {
      void handleSubmitAll();
      return;
    }
    focusNextIncomplete();
  }, [allReady, focusNextIncomplete, handleSubmitAll]);

  if (openInteractions.length === 0 || activeInput === null || activeId === null) {
    return null;
  }

  const activeDraft = draftsById[activeId] ?? "";

  return (
    <div className={askUserPanelShellClass}>
      <AskUserQuestionTabs
        activeKey={activeId}
        keys={interactionIds}
        summaries={openInteractions.map((input, index) => summarizeInteraction(input, index))}
        onSelectKey={setActiveId}
      />
      <div className={askUserPanelBodyClass}>
        <InteractionBody
          draft={activeDraft}
          disabled={disabled}
          input={activeInput}
          onDraftChange={(draft) => {
            handleDraftChange(activeId, draft);
          }}
          onRequestCommit={handleRequestCommit}
        />
      </div>
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-1 px-1">
        <AppTooltip label="中断" side="top" disabled={disabled}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="中断"
            className={cn(
              stopButtonClass,
              "disabled:pointer-events-none disabled:text-ctp-overlay0",
            )}
            disabled={disabled}
            onClick={() => {
              void handleCancelAll();
            }}
          >
            <span aria-hidden="true" className="icon-[codicon--debug-stop] text-sm" />
          </Button>
        </AppTooltip>
        <AppTooltip
          label={allReady ? "提交全部" : "请先填完所有问题"}
          side="top"
          disabled={disabled || !allReady}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="提交全部"
            className={sendButtonClass}
            disabled={disabled || !allReady}
            onClick={() => {
              void handleSubmitAll();
            }}
          >
            <span aria-hidden="true" className="icon-[codicon--newline] text-sm" />
          </Button>
        </AppTooltip>
      </div>
    </div>
  );
}
