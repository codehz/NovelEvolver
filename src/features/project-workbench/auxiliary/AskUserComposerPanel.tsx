import { useCallback, useEffect, useMemo, useState } from "react";

import type { AiChatSnapshot } from "#shared/rpc/ai-rpc";

import {
  findAskUserToolCall,
  listAskUserToolCallsInActiveBatch,
  listAwaitingAskUserToolCalls,
} from "./ask-user-prompt";
import { AskUserComposer } from "./AskUserComposer";
import { AskUserQuestionTabs } from "./AskUserQuestionTabs";

export function AskUserComposerPanel({
  snapshot,
  loading,
  activeToolCallId,
  onSelectToolCallId,
  onSubmit,
}: {
  snapshot: AiChatSnapshot;
  loading: boolean;
  activeToolCallId: string | null;
  onSelectToolCallId: (toolCallId: string) => void;
  onSubmit: (toolCallId: string, text: string) => Promise<boolean>;
}) {
  const batchToolCalls = useMemo(() => listAskUserToolCallsInActiveBatch(snapshot), [snapshot]);
  const awaitingToolCalls = useMemo(() => listAwaitingAskUserToolCalls(snapshot), [snapshot]);
  const [draftsByToolCallId, setDraftsByToolCallId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (awaitingToolCalls.length === 0) {
      return;
    }

    if (
      activeToolCallId === null ||
      !awaitingToolCalls.some((toolCall) => toolCall.id === activeToolCallId)
    ) {
      onSelectToolCallId(awaitingToolCalls[0]!.id);
    }
  }, [activeToolCallId, awaitingToolCalls, onSelectToolCallId]);

  const activeToolCall =
    activeToolCallId === null ? null : findAskUserToolCall(snapshot, activeToolCallId);

  const progressLabel = useMemo(() => {
    if (batchToolCalls.length <= 1) {
      return null;
    }

    const answeredCount = batchToolCalls.filter(
      (toolCall) => toolCall.status === "complete",
    ).length;
    return `${answeredCount}/${batchToolCalls.length} 已答`;
  }, [batchToolCalls]);

  const handleDraftChange = useCallback((toolCallId: string, draft: string) => {
    setDraftsByToolCallId((current) => ({
      ...current,
      [toolCallId]: draft,
    }));
  }, []);

  if (!activeToolCall || activeToolCall.status !== "awaiting_user") {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      <AskUserQuestionTabs
        activeToolCallId={activeToolCallId}
        toolCalls={batchToolCalls.length > 0 ? batchToolCalls : awaitingToolCalls}
        onSelectToolCallId={onSelectToolCallId}
      />
      <AskUserComposer
        draft={draftsByToolCallId[activeToolCall.id] ?? ""}
        loading={loading}
        progressLabel={progressLabel}
        toolCall={activeToolCall}
        onDraftChange={(draft) => {
          handleDraftChange(activeToolCall.id, draft);
        }}
        onSubmit={onSubmit}
      />
    </div>
  );
}
