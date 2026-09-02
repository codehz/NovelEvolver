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
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import IconAdd from "~icons/codicon/add";
import IconBeaker from "~icons/codicon/beaker";
import IconHistory from "~icons/codicon/history";

import { getMobileSettings } from "../../../shared/settings/session";
import { useOverlay } from "../../../shared/ui/OverlayHost";
import { SettingsHeaderButton } from "../../settings/SettingsHeaderButton";
import { errorMessage } from "../error-message";
import type { OpenedProject } from "../git/repository-manager";
import { aiStyles } from "./ai-chrome";
import { AiAskUserBar } from "./AiAskUserBar";
import { AiComposer, type AiComposerHandle } from "./AiComposer";
import { AiHistoryList } from "./AiHistoryList";
import { AiMessageList } from "./AiMessageList";
import { AiPickerList } from "./AiPickerList";
import { AiPickerSheet } from "./AiPickerSheet";
import { filterMentionCatalog, filterPromptItems, type ComposerTrigger } from "./composer-query";
import {
  buildMentionToken,
  kindLabelFor,
  listMentionCatalog,
  toMentionRef,
} from "./mention-catalog";
import { useProjectAi } from "./use-project-ai";

type AiPicker =
  | "history"
  | "models"
  | "agents"
  | "reasoning"
  | "prompts"
  | "mentions"
  | "trigger"
  | "scenarios";

type ProjectAiPaneProps = {
  opened: OpenedProject;
  onWorkspaceDirty: () => void;
};

export function ProjectAiPane({ opened, onWorkspaceDirty }: ProjectAiPaneProps) {
  const overlay = useOverlay();
  const ai = useProjectAi(opened, onWorkspaceDirty);
  const composerRef = useRef<AiComposerHandle>(null);
  const [picker, setPicker] = useState<AiPicker | null>(null);
  const [trigger, setTrigger] = useState<ComposerTrigger | null>(null);
  const [triggerQuery, setTriggerQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [slash, setSlash] = useState<AiChatSlashRef | null>(null);
  const [mentions, setMentions] = useState<AiChatMentionRef[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);

  const outline = opened.worktree.getManuscriptOutline();
  const resourceTree = opened.worktree.getResourceTree();
  const mentionItems = listMentionCatalog(outline, resourceTree);
  const prompts = getMobileSettings().prompts.getSnapshot().prompts;
  const historyHits: AiConversationSearchHit[] | null =
    historyQuery.trim() === "" ? null : ai.searchConversations(historyQuery, includeArchived);

  const closePicker = () => {
    setPicker(null);
    if (trigger !== null) {
      setTrigger(null);
      setTriggerQuery("");
    }
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
    setTrigger(null);
    setTriggerQuery("");
    closePicker();
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
    setPicker(null);
    setTrigger(null);
    setTriggerQuery("");
  };

  const handlePickMention = (item: (typeof mentionItems)[number]) => {
    const existing = new Set(mentions.map((mention) => mention.token));
    const token = buildMentionToken(item, existing);
    composerRef.current?.setMention(item, token);
    setMentions((current) => [...current, toMentionRef(item, token)]);
    setPicker(null);
    setTrigger(null);
    setTriggerQuery("");
  };

  const selectedModel = ai.models.find((model) => model.id === ai.snapshot.selectedModelId);
  const pickerTitle =
    picker === "history"
      ? "历史会话"
      : picker === "models"
        ? "选择模型"
        : picker === "agents"
          ? "选择 Agent"
          : picker === "reasoning"
            ? "推理强度"
            : picker === "prompts"
              ? "插入提示词"
              : picker === "mentions"
                ? "提及节点"
                : picker === "trigger"
                  ? trigger === "/"
                    ? "插入提示词"
                    : "提及节点"
                  : "测试场景";

  return (
    <KeyboardAvoidingView
      style={aiStyles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={aiStyles.header}>
        <View style={aiStyles.headerTitleWrap}>
          <Text style={aiStyles.title}>AI</Text>
          <Text style={aiStyles.subtitle}>助手</Text>
        </View>
        <View style={aiStyles.headerActions}>
          {__DEV__ ? (
            <SettingsHeaderButton
              Icon={IconBeaker}
              label="测试场景"
              onPress={() => {
                setPicker("scenarios");
              }}
            />
          ) : null}
          <SettingsHeaderButton
            Icon={IconHistory}
            label="历史会话"
            onPress={() => {
              setPicker("history");
            }}
          />
          <SettingsHeaderButton Icon={IconAdd} label="新建会话" onPress={handleCreate} />
        </View>
      </View>

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
        {picker === "trigger" ? (
          <View style={aiStyles.triggerPicker}>
            <Text style={aiStyles.triggerPickerTitle}>
              {trigger === "/" ? "插入提示词" : "提及节点"}
              {triggerQuery !== "" ? ` · ${trigger}${triggerQuery}` : ""}
            </Text>
            {trigger === "/" ? (
              <AiPickerList
                inline
                empty="还没有匹配的提示词。"
                items={filterPromptItems(prompts, triggerQuery).map((prompt) => ({
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
            ) : (
              <AiPickerList
                inline
                empty="没有匹配的项目节点。"
                items={filterMentionCatalog(mentionItems, triggerQuery).map((item) => ({
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
            )}
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
            draft={draft}
            slash={slash}
            mentions={mentions}
            onDraftChange={setDraft}
            onTriggerChange={(indicator, query) => {
              setTrigger(indicator);
              setTriggerQuery(query);
              if (indicator !== null) {
                setPicker("trigger");
              } else if (picker === "trigger") {
                setPicker(null);
              }
            }}
            onClearSlash={() => {
              setSlash(null);
            }}
            onRemoveMention={(token) => {
              setMentions((current) => current.filter((item) => item.token !== token));
            }}
            onOpenModels={() => {
              setPicker("models");
            }}
            onOpenAgents={() => {
              setPicker("agents");
            }}
            onOpenReasoning={() => {
              setPicker("reasoning");
            }}
            onOpenPrompts={() => {
              composerRef.current?.startMention("/");
              setTrigger("/");
              setTriggerQuery("");
              setPicker("trigger");
            }}
            onOpenMentions={() => {
              composerRef.current?.startMention("@");
              setTrigger("@");
              setTriggerQuery("");
              setPicker("trigger");
            }}
            onSend={handleSend}
            onStop={ai.stopGeneration}
          />
        )}
      </View>

      <AiPickerSheet
        title={pickerTitle}
        visible={picker !== null && picker !== "trigger"}
        onDismiss={closePicker}
      >
        {picker === "history" ? (
          <AiHistoryList
            conversations={ai.conversations}
            hits={historyHits}
            activeId={ai.snapshot.conversationId}
            query={historyQuery}
            includeArchived={includeArchived}
            onQueryChange={setHistoryQuery}
            onToggleArchived={() => {
              setIncludeArchived((value) => !value);
            }}
            onSelect={handleSelectConversation}
            onRename={(conversation) => {
              void handleRename(conversation);
            }}
            onArchive={(conversation) => {
              ai.archiveConversation(conversation.id);
            }}
            onUnarchive={(conversation) => {
              ai.unarchiveConversation(conversation.id);
            }}
            onDelete={(conversation) => {
              void handleDelete(conversation);
            }}
          />
        ) : null}

        {picker === "models" ? (
          <AiPickerList
            empty="还没有可用模型。请先在设置中添加。"
            items={ai.models.map((model) => ({
              id: model.id,
              title: model.name,
              detail: `${model.kind} · ${model.model}`,
              selected: model.id === ai.snapshot.selectedModelId,
            }))}
            onSelect={(id) => {
              try {
                ai.setSelectedModel(id);
                closePicker();
              } catch (error) {
                void overlay.alert({ title: "无法切换模型", message: errorMessage(error) });
              }
            }}
          />
        ) : null}

        {picker === "agents" ? (
          <AiPickerList
            empty="没有可选 Agent。"
            items={ai.agents.map((agent) => ({
              id: agent.id,
              title: agent.name,
              detail: agent.description,
              selected: agent.id === ai.snapshot.selectedAgentId,
            }))}
            onSelect={(id) => {
              try {
                ai.setSelectedAgent(id);
                closePicker();
              } catch (error) {
                void overlay.alert({ title: "无法切换 Agent", message: errorMessage(error) });
              }
            }}
          />
        ) : null}

        {picker === "reasoning" ? (
          <AiPickerList
            empty="当前模型不支持推理强度。"
            items={(selectedModel?.availableReasoningLevels ?? []).map((level) => ({
              id: level,
              title: AI_REASONING_LEVEL_LABELS[level],
              selected: level === ai.snapshot.selectedReasoningLevel,
            }))}
            onSelect={(id) => {
              ai.setSelectedReasoningLevel(id as AiReasoningLevel);
              closePicker();
            }}
          />
        ) : null}

        {picker === "prompts" ? (
          <AiPickerList
            empty="还没有自定义提示词。"
            items={prompts.map((prompt) => ({
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
        ) : null}

        {picker === "mentions" ? (
          <AiPickerList
            empty="项目里还没有可提及的节点。"
            items={mentionItems.map((item) => ({
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

        {picker === "scenarios" ? (
          <AiPickerList
            empty="没有测试场景。"
            items={listMockScenarios().map((scenario) => ({
              id: scenario.id,
              title: scenario.title,
              detail: scenario.description,
            }))}
            onSelect={(id) => {
              try {
                ai.runScenario(id);
                closePicker();
              } catch (error) {
                void overlay.alert({ title: "无法运行场景", message: errorMessage(error) });
              }
            }}
          />
        ) : null}
      </AiPickerSheet>
    </KeyboardAvoidingView>
  );
}
