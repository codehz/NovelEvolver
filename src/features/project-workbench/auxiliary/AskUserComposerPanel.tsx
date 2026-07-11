import { useCallback, useEffect, useMemo, useState } from "react";

import type { AiChatUserInputHandle } from "#shared/rpc/ai-rpc";

import { AskUserComposer } from "./AskUserComposer";
import { AskUserQuestionTabs } from "./AskUserQuestionTabs";
import { handleKey, summarizeHandlePrompt } from "./handle-keys";

/**
 * 当 AI 请求需要用户回答时，底部 composer 区域按 handle.kind 分派渲染对应的输入 UI。
 *
 * handle 是服务端推过来的活对象：客户端直接调用 `submitAnswer`/`cancel` 等方法把
 * 类型化的回答交还服务端，无须知道内部 toolCallId，也无须固定的 response 形状。
 * 当前仅支持 `ask_user`；新增工具只需在此 switch 增加一个 case 与对应 composer。
 */
export function AskUserComposerPanel({
  loading,
  pendingInputs,
}: {
  loading: boolean;
  pendingInputs: AiChatUserInputHandle[];
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draftsByKey, setDraftsByKey] = useState<Record<string, string>>({});

  const pendingKeys = useMemo(() => pendingInputs.map(handleKey), [pendingInputs]);

  useEffect(() => {
    if (pendingInputs.length === 0) {
      return;
    }
    if (activeKey === null || !pendingKeys.includes(activeKey)) {
      setActiveKey(pendingKeys[0] ?? null);
    }
  }, [activeKey, pendingInputs, pendingKeys]);

  const activeHandle =
    activeKey === null
      ? null
      : (pendingInputs.find((handle) => handleKey(handle) === activeKey) ?? null);

  const handleDraftChange = useCallback((key: string, draft: string) => {
    setDraftsByKey((current) => ({ ...current, [key]: draft }));
  }, []);

  if (pendingInputs.length === 0 || activeHandle === null || activeKey === null) {
    return null;
  }

  const activeKeyStr = activeKey;
  const activeDraft = draftsByKey[activeKeyStr] ?? "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      <AskUserQuestionTabs
        activeKey={activeKeyStr}
        keys={pendingKeys}
        summaries={pendingInputs.map((handle, index) => summarizeHandlePrompt(handle, index))}
        onSelectKey={setActiveKey}
      />
      <AskUserDispatcher
        draft={activeDraft}
        handle={activeHandle}
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

function AskUserDispatcher({
  handle,
  loading,
  draft,
  onDraftChange,
  onSubmitted,
}: {
  handle: AiChatUserInputHandle;
  loading: boolean;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSubmitted: () => void;
}) {
  switch (handle.kind) {
    case "ask_user":
      return (
        <AskUserComposer
          draft={draft}
          handle={handle}
          loading={loading}
          onDraftChange={onDraftChange}
          onSubmitted={onSubmitted}
        />
      );
    default:
      return null;
  }
}
