import { useCallback, useEffect, useMemo, useState } from "react";

import type { AiChatPendingUserInput } from "#shared/rpc/ai/index";

import { AskUserQuestionTabs } from "./AskUserQuestionTabs";
import { pendingInputKey, summarizePendingInput } from "./handle-keys";
import { PendingInputComposer } from "./pending-input-contributions";

/**
 * 当 AI 请求需要用户回答时，底部 composer 区域按 pending.kind 分派渲染对应的输入 UI。
 *
 * 展示数据来自按值推送的 DTO；回传通过条目上的瘦 handle（submitAnswer/cancel）。
 * 当前仅支持 `ask_user`；新增工具只需在此 switch 增加一个 case 与对应 composer。
 */
type AskUserComposerPanelProps = {
  loading: boolean;
  pendingInputs: AiChatPendingUserInput[];
};

export function AskUserComposerPanel({ loading, pendingInputs }: AskUserComposerPanelProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draftsByKey, setDraftsByKey] = useState<Record<string, string>>({});

  const pendingKeys = useMemo(() => pendingInputs.map(pendingInputKey), [pendingInputs]);

  useEffect(() => {
    if (pendingInputs.length === 0) {
      return;
    }
    if (activeKey === null || !pendingKeys.includes(activeKey)) {
      setActiveKey(pendingKeys[0] ?? null);
    }
  }, [activeKey, pendingInputs, pendingKeys]);

  const activeInput =
    activeKey === null
      ? null
      : (pendingInputs.find((input) => pendingInputKey(input) === activeKey) ?? null);

  const handleDraftChange = useCallback((key: string, draft: string) => {
    setDraftsByKey((current) => ({ ...current, [key]: draft }));
  }, []);

  if (pendingInputs.length === 0 || activeInput === null || activeKey === null) {
    return null;
  }

  const activeKeyStr = activeKey;
  const activeDraft = draftsByKey[activeKeyStr] ?? "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-1">
      <AskUserQuestionTabs
        activeKey={activeKeyStr}
        keys={pendingKeys}
        summaries={pendingInputs.map((input, index) => summarizePendingInput(input, index))}
        onSelectKey={setActiveKey}
      />
      <PendingInputComposer
        draft={activeDraft}
        input={activeInput}
        loading={loading}
        onDraftChange={(draft) => {
          handleDraftChange(activeKeyStr, draft);
        }}
        onSubmitted={() => {
          setDraftsByKey((current) => {
            const next = { ...current };
            delete next[activeKeyStr];
            return next;
          });
        }}
      />
    </div>
  );
}
