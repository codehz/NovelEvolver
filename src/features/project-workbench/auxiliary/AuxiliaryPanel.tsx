import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { ScrollArea } from "#app/shared/ui/ScrollArea";
import type { AiChatSelectableModel } from "#shared/rpc/ai/index";
import { SidebarHeaderActionButton, SidebarHeaderActions } from "#workbench/chrome";

import { useProjectContext } from "../state/molecules";
import { pickAiConversation } from "./ai-chat-history-quick-pick";
import {
  composerShellClass,
  composerTextareaClass,
  conversationRailClass,
  modelSelectorButtonClass,
  modelSelectorLabelClass,
  panelSectionClass,
  sendButtonClass,
  warningBannerClass,
} from "./ai-chat-ui";
import { AiMessageBlock } from "./AiMessageBlock";
import { AskUserComposerPanel } from "./AskUserComposerPanel";
import { pickMockAiScenario } from "./mock-scenario-quick-pick";
import { pickAiChatModel } from "./model-selector-quick-pick";
import { useAiChatState } from "./use-ai-chat-state";

export function AuxiliaryPanel() {
  const project = useProjectContext();
  const {
    snapshot,
    loading,
    subscriptionError,
    sendMessage,
    createConversation,
    listConversations,
    switchConversation,
    listSelectableModels,
    setSelectedModel,
  } = useAiChatState();
  const [draft, setDraft] = useState("");
  const [mockAiAvailable, setMockAiAvailable] = useState(false);
  const [selectableModels, setSelectableModels] = useState<AiChatSelectableModel[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldRestoreComposerFocusRef = useRef(false);

  const hasPendingUserInputs = snapshot.pendingUserInputs.length > 0;

  useEffect(() => {
    let active = true;
    void Promise.resolve(project.getMockAiControl()).then((control) => {
      if (active) {
        setMockAiAvailable(control !== null);
      }
    });
    return () => {
      active = false;
    };
  }, [project]);

  useEffect(() => {
    let active = true;
    void listSelectableModels().then((models) => {
      if (active) {
        setSelectableModels(models);
      }
    });
    return () => {
      active = false;
    };
  }, [listSelectableModels, snapshot.selectedModelId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [snapshot.messages, snapshot.pending, snapshot.pendingUserInputs]);

  useEffect(() => {
    if (
      loading ||
      snapshot.pending ||
      hasPendingUserInputs ||
      !shouldRestoreComposerFocusRef.current
    ) {
      return;
    }

    composerRef.current?.focus();
    shouldRestoreComposerFocusRef.current = false;
  }, [hasPendingUserInputs, loading, snapshot.pending]);

  const submitDraft = useCallback(async (): Promise<void> => {
    const submitted = await sendMessage(draft);
    if (submitted) {
      shouldRestoreComposerFocusRef.current = true;
      setDraft("");
    }
  }, [draft, sendMessage]);

  const handleSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitDraft();
    },
    [submitDraft],
  );

  const handleSendClick = useCallback(() => {
    void submitDraft();
  }, [submitDraft]);

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      event.preventDefault();
      void submitDraft();
    },
    [submitDraft],
  );

  const handleOpenHistory = useCallback(async () => {
    if (loading) {
      return;
    }

    const conversations = await listConversations();
    const selectedId = await pickAiConversation({
      conversations,
      activeConversationId: snapshot.conversationId,
    });
    if (selectedId === null || selectedId === snapshot.conversationId) {
      return;
    }

    setDraft("");
    await switchConversation(selectedId);
  }, [listConversations, loading, snapshot.conversationId, switchConversation]);

  const handleCreateConversation = useCallback(async () => {
    if (loading) {
      return;
    }

    setDraft("");
    await createConversation();
  }, [createConversation, loading]);

  const handleRunMockScenario = useCallback(async () => {
    if (loading) {
      return;
    }
    const control = await Promise.resolve(project.getMockAiControl());
    if (!control) {
      return;
    }
    const scenarios = await Promise.resolve(control.listScenarios());
    const scenarioId = await pickMockAiScenario(scenarios);
    if (!scenarioId) {
      return;
    }
    setDraft("");
    await Promise.resolve(
      control.runScenario({ scenarioId, pacing: "preview", persistence: "persistent" }),
    );
  }, [loading, project]);

  const handlePickModel = useCallback(async () => {
    if (loading || snapshot.pending) {
      return;
    }
    const models = await listSelectableModels();
    setSelectableModels(models);
    const selectedId = await pickAiChatModel(models, snapshot.selectedModelId);
    if (!selectedId || selectedId === snapshot.selectedModelId) {
      return;
    }
    await setSelectedModel(selectedId);
  }, [listSelectableModels, loading, setSelectedModel, snapshot.pending, snapshot.selectedModelId]);

  const errorMessage = subscriptionError ?? snapshot.errorMessage;
  const selectedModel =
    selectableModels.find((model) => model.id === snapshot.selectedModelId) ?? null;
  const selectedModelLabel = selectedModel?.name
    ? selectedModel.name
    : snapshot.selectedModelId
      ? "未知模型"
      : "选择模型";

  const messageIdSet = new Set(snapshot.messages.map((message) => message.id));
  const warningsByMessageId = new Map<string, typeof snapshot.warnings>();
  const orphanWarnings: typeof snapshot.warnings = [];
  for (const warning of snapshot.warnings) {
    if (warning.messageId !== "" && messageIdSet.has(warning.messageId)) {
      const list = warningsByMessageId.get(warning.messageId);
      if (list) {
        list.push(warning);
      } else {
        warningsByMessageId.set(warning.messageId, [warning]);
      }
    } else {
      orphanWarnings.push(warning);
    }
  }

  return (
    <>
      <SidebarHeaderActions>
        {mockAiAvailable ? (
          <SidebarHeaderActionButton
            disabled={loading || snapshot.pending}
            icon="icon-[codicon--beaker]"
            label="运行 AI 测试场景"
            onClick={() => {
              void handleRunMockScenario();
            }}
          />
        ) : null}
        <SidebarHeaderActionButton
          disabled={loading}
          icon="icon-[codicon--history]"
          label="历史会话"
          onClick={() => {
            void handleOpenHistory();
          }}
        />
        <SidebarHeaderActionButton
          disabled={loading}
          icon="icon-[codicon--add]"
          label="新建会话"
          onClick={() => {
            void handleCreateConversation();
          }}
        />
      </SidebarHeaderActions>

      <ScrollArea className="min-h-0 flex-1" fill>
        <div className={cn(panelSectionClass, conversationRailClass, "text-sm")}>
          {snapshot.scenarioId ? (
            <div className="text-2xs text-ctp-subtext0">
              测试场景 · <span className="font-mono text-ctp-mauve">{snapshot.scenarioId}</span>
            </div>
          ) : null}
          {errorMessage ? (
            <div className="rounded-xl border border-ctp-red/40 bg-ctp-red/10 px-3 py-2 text-xs text-ctp-red">
              {errorMessage}
            </div>
          ) : null}

          {orphanWarnings.map((warning) => (
            <div className={warningBannerClass} key={warning.id}>
              {warning.code ? <span className="font-mono">{warning.code}: </span> : null}
              {warning.message}
            </div>
          ))}

          {loading ? (
            <div className="rounded-xl bg-app-background p-3 text-center text-xs text-ctp-subtext0">
              正在连接 AI 会话…
            </div>
          ) : null}

          {!loading && snapshot.messages.length === 0 ? (
            <div className="px-1 py-4 text-xs text-ctp-subtext0">开始一段对话。</div>
          ) : null}

          {snapshot.messages.map((message) => {
            const messageWarnings = warningsByMessageId.get(message.id) ?? [];
            return (
              <div className="flex flex-col gap-2" key={message.id}>
                <AiMessageBlock message={message} />
                {messageWarnings.map((warning) => (
                  <div className={warningBannerClass} key={warning.id}>
                    {warning.code ? <span className="font-mono">{warning.code}: </span> : null}
                    {warning.message}
                  </div>
                ))}
              </div>
            );
          })}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0"
            ref={endRef}
          />
        </div>
      </ScrollArea>

      <footer className="shrink-0 p-3">
        {hasPendingUserInputs ? (
          <AskUserComposerPanel loading={loading} pendingInputs={snapshot.pendingUserInputs} />
        ) : (
          <form className={composerShellClass} onSubmit={handleSubmit}>
            <textarea
              aria-label="消息输入"
              className={composerTextareaClass}
              ref={composerRef}
              placeholder="输入章节目标、修改要求，或直接粘贴长段正文…"
              rows={6}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onKeyDown={handleComposerKeyDown}
              disabled={loading || snapshot.pending}
            />

            <div className="flex items-center justify-end gap-2">
              <button
                aria-label="选择模型"
                className={modelSelectorButtonClass}
                disabled={loading || snapshot.pending}
                title={selectedModelLabel}
                type="button"
                onClick={() => {
                  void handlePickModel();
                }}
              >
                <span aria-hidden="true" className="icon-[codicon--hubot] shrink-0 text-sm" />
                <span className={modelSelectorLabelClass}>{selectedModelLabel}</span>
                <span
                  aria-hidden="true"
                  className="icon-[codicon--chevron-down] shrink-0 text-xs opacity-70"
                />
              </button>
              <button
                aria-label="发送"
                className={sendButtonClass}
                disabled={loading || snapshot.pending || draft.trim() === ""}
                title="发送"
                type="button"
                onClick={handleSendClick}
              >
                <span aria-hidden="true" className="icon-[codicon--send] text-sm" />
              </button>
            </div>
          </form>
        )}
      </footer>
    </>
  );
}
