import { listMockScenarios } from "@novelevolver/ai-runtime";
import type {
  AiChatMentionRef,
  AiChatSlashRef,
  AiChatUserMessage,
  AiConversationSearchHit,
  AiConversationSummary,
} from "@novelevolver/domain/ai";
import {
  AI_REASONING_LEVEL_LABELS,
  type AiPromptConfigPublic,
  type AiReasoningLevel,
} from "@novelevolver/domain/settings/ai-settings";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import IconAdd from "~icons/codicon/add";
import IconBeaker from "~icons/codicon/beaker";
import IconHistory from "~icons/codicon/history";

import { getMobileSettings } from "../../../shared/settings/session";
import { useOverlay } from "../../../shared/ui/OverlayHost";
import { SettingsHeaderButton } from "../../settings/SettingsHeaderButton";
import { errorMessage } from "../error-message";
import type { OpenedProject } from "../git/repository-manager";
import { projectPaneStyles } from "../project-pane-chrome";
import { ProjectMediumHeader, type ProjectMediumHeaderNavigation } from "../ProjectMediumHeader";
import { aiStyles } from "./ai-chrome";
import { AiAskUserBar } from "./AiAskUserBar";
import { AiComposer, type AiComposerHandle } from "./AiComposer";
import { AiMessageList } from "./AiMessageList";
import { AiPickerList } from "./AiPickerList";
import { filterMentionCatalog, filterPromptItems, type ComposerTrigger } from "./composer-query";
import {
  buildMentionToken,
  kindLabelFor,
  listMentionCatalog,
  toMentionRef,
} from "./mention-catalog";
import { useProjectAi } from "./use-project-ai";

type AiMenu = "history" | "models" | "agents" | "reasoning" | "scenarios";

type MenuAnchor = {
  type: "point";
  x: number;
  y: number;
};

type ProjectAiPaneProps = {
  opened: OpenedProject;
  onWorkspaceDirty: () => void;
  mediumHeader?: ProjectMediumHeaderNavigation;
};

export function ProjectAiPane({ opened, onWorkspaceDirty, mediumHeader }: ProjectAiPaneProps) {
  const overlay = useOverlay();
  const ai = useProjectAi(opened, onWorkspaceDirty);
  const composerRef = useRef<AiComposerHandle>(null);
  const [trigger, setTrigger] = useState<ComposerTrigger | null>(null);
  const [triggerQuery, setTriggerQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [slash, setSlash] = useState<AiChatSlashRef | null>(null);
  const [mentions, setMentions] = useState<AiChatMentionRef[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);

  const outline = opened.worktree.getManuscriptOutline();
  const resourceTree = opened.worktree.getResourceTree();
  const mentionItems = listMentionCatalog(outline, resourceTree);
  const prompts = getMobileSettings().prompts.getSnapshot().prompts;

  const clearTrigger = () => {
    setTrigger(null);
    setTriggerQuery("");
  };

  const handleCreate = () => {
    ai.createConversation();
    composerRef.current?.clear();
    setDraft("");
    setSlash(null);
    setMentions([]);
    setTrigger(null);
    setTriggerQuery("");
  };

  const handleSelectConversation = (conversationId: string) => {
    ai.switchConversation(conversationId);
    composerRef.current?.clear();
    setDraft("");
    setSlash(null);
    setMentions([]);
    clearTrigger();
  };

  const handleRename = async (conversation: AiConversationSummary) => {
    const title = await overlay.prompt({
      title: "重命名会话",
      initialValue: conversation.title,
      confirmLabel: "保存",
    });
    if (title === null) {
      return;
    }
    try {
      ai.renameConversation(conversation.id, title);
    } catch (error) {
      await overlay.alert({ title: "重命名失败", message: errorMessage(error) });
    }
  };

  const handleDelete = async (conversation: AiConversationSummary) => {
    const confirmed = await overlay.confirm({
      title: "删除会话？",
      message: "删除后无法恢复。",
      confirmLabel: "删除",
    });
    if (!confirmed) {
      return;
    }
    try {
      ai.deleteConversation(conversation.id);
    } catch (error) {
      await overlay.alert({ title: "删除失败", message: errorMessage(error) });
    }
  };

  const handleEditUser = async (message: AiChatUserMessage) => {
    const text = await overlay.prompt({
      title: "编辑消息",
      initialValue: message.text,
      confirmLabel: "发送",
    });
    if (text === null) {
      return;
    }
    ai.editUserMessage(message.id, {
      text,
      slash: message.slash,
      mentions: message.mentions,
    });
  };

  const handleSend = () => {
    const sent = ai.sendMessage(
      composerRef.current?.getSendPayload() ?? { text: draft, slash, mentions },
    );
    if (sent) {
      composerRef.current?.clear();
      setDraft("");
      setSlash(null);
      setMentions([]);
      setTrigger(null);
      setTriggerQuery("");
    }
  };

  const handlePickPrompt = (prompt: AiPromptConfigPublic) => {
    const slashRef = {
      promptId: prompt.id,
      slug: prompt.slug,
      title: prompt.title,
      body: prompt.prompt,
    };
    composerRef.current?.setPrompt(slashRef);
    setSlash(slashRef);
    clearTrigger();
  };

  const handlePickMention = (item: (typeof mentionItems)[number]) => {
    const existing = new Set(mentions.map((mention) => mention.token));
    const token = buildMentionToken(item, existing);
    composerRef.current?.setMention(item, token);
    setMentions((current) => [...current, toMentionRef(item, token)]);
    clearTrigger();
  };

  const filteredPromptItems = filterPromptItems(prompts, triggerQuery);
  const filteredMentionItems = filterMentionCatalog(mentionItems, triggerQuery);
  const selectedModel = ai.models.find((model) => model.id === ai.snapshot.selectedModelId);

  const anchorFromEvent = (event: GestureResponderEvent): MenuAnchor => ({
    type: "point",
    x: event.nativeEvent.pageX,
    y: event.nativeEvent.pageY,
  });

  const openConversationActions = async (
    conversation: AiConversationSummary,
    anchor: MenuAnchor,
  ) => {
    const action = await overlay.menu({
      anchor,
      title: conversation.title || "新会话",
      options: [
        { key: "rename", label: "重命名" },
        {
          key: conversation.status === "archived" ? "unarchive" : "archive",
          label: conversation.status === "archived" ? "取消归档" : "归档",
        },
        { key: "delete", label: "删除", destructive: true },
      ],
    });
    if (action === "rename") await handleRename(conversation);
    if (action === "archive") ai.archiveConversation(conversation.id);
    if (action === "unarchive") ai.unarchiveConversation(conversation.id);
    if (action === "delete") await handleDelete(conversation);
  };

  const openHistoryChoices = async (
    anchor: MenuAnchor,
    conversations: readonly (AiConversationSummary | AiConversationSearchHit)[],
    title: string,
    showControls: boolean,
    showArchived: boolean,
  ) => {
    const action = await overlay.menu({
      anchor,
      width: "wide",
      title,
      selectedKey: ai.snapshot.conversationId,
      emptyLabel: "没有匹配的会话。",
      options: [
        ...(showControls
          ? [
              { key: "action:search", label: "搜索会话…" },
              { key: "action:manage", label: "管理当前会话…" },
              {
                key: "action:archived",
                label: showArchived ? "隐藏已归档" : "显示已归档",
              },
            ]
          : []),
        ...conversations.map((conversation) => ({
          key: conversation.id,
          label: conversation.title || "新会话",
          detail:
            "snippet" in conversation && conversation.snippet
              ? conversation.snippet
              : conversation.status === "archived"
                ? "已归档"
                : undefined,
        })),
      ],
    });

    if (action === "action:search") {
      const query = await overlay.prompt({
        title: "搜索会话",
        placeholder: "标题或消息内容",
        confirmLabel: "搜索",
      });
      if (query !== null) {
        const hits = ai.searchConversations(query, showArchived);
        await openHistoryChoices(anchor, hits, `搜索：${query}`, false, showArchived);
      }
      return;
    }
    if (action === "action:manage") {
      const current = ai.conversations.find(
        (conversation) => conversation.id === ai.snapshot.conversationId,
      );
      if (current) await openConversationActions(current, anchor);
      return;
    }
    if (action === "action:archived") {
      const nextIncludeArchived = !showArchived;
      setIncludeArchived(nextIncludeArchived);
      const visible = nextIncludeArchived
        ? ai.conversations
        : ai.conversations.filter((conversation) => conversation.status !== "archived");
      await openHistoryChoices(anchor, visible, "历史会话", true, nextIncludeArchived);
      return;
    }
    if (action !== null) handleSelectConversation(action);
  };

  const openAiMenu = async (kind: AiMenu, event: GestureResponderEvent) => {
    const anchor = anchorFromEvent(event);
    if (kind === "history") {
      const visible = includeArchived
        ? ai.conversations
        : ai.conversations.filter((conversation) => conversation.status !== "archived");
      await openHistoryChoices(anchor, visible, "历史会话", true, includeArchived);
      return;
    }

    const request =
      kind === "models"
        ? {
            title: "选择模型",
            emptyLabel: "还没有可用模型。请先在设置中添加。",
            selectedKey: ai.snapshot.selectedModelId,
            options: ai.models.map((model) => ({
              key: model.id,
              label: model.name,
              detail: `${model.kind} · ${model.model}`,
            })),
          }
        : kind === "agents"
          ? {
              title: "选择 Agent",
              emptyLabel: "没有可选 Agent。",
              selectedKey: ai.snapshot.selectedAgentId,
              options: ai.agents.map((agent) => ({
                key: agent.id,
                label: agent.name,
                detail: agent.description,
              })),
            }
          : kind === "reasoning"
            ? {
                title: "推理强度",
                emptyLabel: "当前模型不支持推理强度。",
                selectedKey: ai.snapshot.selectedReasoningLevel ?? undefined,
                options: (selectedModel?.availableReasoningLevels ?? []).map((level) => ({
                  key: level,
                  label: AI_REASONING_LEVEL_LABELS[level],
                })),
              }
            : {
                title: "测试场景",
                emptyLabel: "没有测试场景。",
                options: listMockScenarios().map((scenario) => ({
                  key: scenario.id,
                  label: scenario.title,
                  detail: scenario.description,
                })),
              };
    const selection = await overlay.menu({ anchor, width: "wide", ...request });
    if (selection === null) return;

    try {
      if (kind === "models") ai.setSelectedModel(selection);
      if (kind === "agents") ai.setSelectedAgent(selection);
      if (kind === "reasoning") ai.setSelectedReasoningLevel(selection as AiReasoningLevel);
      if (kind === "scenarios") ai.runScenario(selection);
    } catch (error) {
      await overlay.alert({ title: "操作失败", message: errorMessage(error) });
    }
  };

  const headerActions = (
    <>
      {__DEV__ ? (
        <SettingsHeaderButton
          Icon={IconBeaker}
          label="测试场景"
          onPress={(event) => {
            void openAiMenu("scenarios", event);
          }}
        />
      ) : null}
      <SettingsHeaderButton
        Icon={IconHistory}
        label="历史会话"
        onPress={(event) => {
          void openAiMenu("history", event);
        }}
      />
      <SettingsHeaderButton Icon={IconAdd} label="新建会话" onPress={handleCreate} />
    </>
  );

  return (
    <KeyboardAvoidingView
      style={aiStyles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {mediumHeader ? (
        <ProjectMediumHeader
          {...mediumHeader}
          context={
            <View style={aiStyles.headerTitleWrap}>
              <Text style={aiStyles.title}>AI</Text>
              <Text style={aiStyles.subtitle}>助手</Text>
            </View>
          }
          actions={headerActions}
        />
      ) : (
        <View style={[projectPaneStyles.header, aiStyles.header]}>
          <View style={aiStyles.headerTitleWrap}>
            <Text style={aiStyles.title}>AI</Text>
            <Text style={aiStyles.subtitle}>助手</Text>
          </View>
          <View style={aiStyles.headerActions}>{headerActions}</View>
        </View>
      )}

      <AiMessageList
        snapshot={ai.snapshot}
        onRetry={ai.snapshot.canRetry ? ai.retryLastRequest : undefined}
        onContinue={ai.snapshot.canContinue ? ai.continueLastRequest : undefined}
        onSelectBranch={ai.selectMessageBranch}
        onEditUser={(message) => {
          void handleEditUser(message);
        }}
      />
      <View style={aiStyles.composerDock}>
        {trigger !== null ? (
          <View style={aiStyles.triggerPicker}>
            <Text style={aiStyles.triggerPickerTitle}>
              {trigger === "/" ? "插入提示词" : "提及节点"}
              {triggerQuery !== "" ? ` · ${trigger}${triggerQuery}` : ""}
            </Text>
            {trigger === "/" ? (
              filteredPromptItems.length > 0 ? (
                <AiPickerList
                  inline
                  empty="还没有匹配的提示词。"
                  items={filteredPromptItems.map((prompt) => ({
                    id: prompt.id,
                    title: `/${prompt.slug}`,
                    detail: prompt.title,
                  }))}
                  onSelect={(id) => {
                    const prompt = prompts.find((item) => item.id === id);
                    if (prompt) {
                      handlePickPrompt(prompt);
                    }
                  }}
                />
              ) : null
            ) : filteredMentionItems.length > 0 ? (
              <AiPickerList
                inline
                empty="没有匹配的项目节点。"
                items={filteredMentionItems.map((item) => ({
                  id: `${item.domain}:${item.id}`,
                  title: `@${item.label}`,
                  detail: `${kindLabelFor(item.kind, item.domain)} · ${item.displayPath}`,
                }))}
                onSelect={(id) => {
                  const item = mentionItems.find((entry) => `${entry.domain}:${entry.id}` === id);
                  if (item) {
                    handlePickMention(item);
                  }
                }}
              />
            ) : null}
          </View>
        ) : null}
        {ai.snapshot.openInteractions.length > 0 ? (
          <AiAskUserBar
            interactions={ai.snapshot.openInteractions}
            onSubmit={(id, text) => {
              ai.submitInteraction(id, { kind: "ask_user", text });
            }}
            onCancel={ai.cancelInteraction}
          />
        ) : (
          <AiComposer
            ref={composerRef}
            snapshot={ai.snapshot}
            models={ai.models}
            agents={ai.agents}
            prompts={prompts.map((prompt) => ({
              promptId: prompt.id,
              slug: prompt.slug,
              title: prompt.title,
              body: prompt.prompt,
            }))}
            mentionItems={mentionItems}
            draft={draft}
            slash={slash}
            mentions={mentions}
            onDraftChange={setDraft}
            onTriggerChange={(indicator, query) => {
              setTrigger(indicator);
              setTriggerQuery(query);
            }}
            onClearSlash={() => {
              setSlash(null);
            }}
            onRemoveMention={(token) => {
              setMentions((current) => current.filter((item) => item.token !== token));
            }}
            onOpenModels={(event) => {
              void openAiMenu("models", event);
            }}
            onOpenAgents={(event) => {
              void openAiMenu("agents", event);
            }}
            onOpenReasoning={(event) => {
              void openAiMenu("reasoning", event);
            }}
            onSend={handleSend}
            onStop={ai.stopGeneration}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
