import { listMockScenarios } from "@novelevolver/ai-runtime";
import type { AiChatMentionRef, AiChatSlashRef, AiChatUserMessage } from "@novelevolver/domain/ai";
import {
  AI_REASONING_LEVEL_LABELS,
  type AiPromptConfigPublic,
  type AiReasoningLevel,
} from "@novelevolver/domain/settings/ai-settings";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import IconAdd from "~icons/codicon/add";
import IconBeaker from "~icons/codicon/beaker";
import IconHistory from "~icons/codicon/history";

import { getMobileSettings } from "../../../shared/settings/session";
import type { ContextMenuAnchor } from "../../../shared/ui/context-menu-position";
import { OVERLAY_TIMING } from "../../../shared/ui/overlay-chrome";
import { useOverlay } from "../../../shared/ui/OverlayHost";
import { SettingsHeaderButton } from "../../settings/SettingsHeaderButton";
import { errorMessage } from "../error-message";
import type { OpenedProject } from "../git/repository-manager";
import { projectPaneStyles } from "../project-pane-chrome";
import { aiStyles } from "./ai-chrome";
import { AiAskUserBar } from "./AiAskUserBar";
import { AiChatHistoryPage } from "./AiChatHistoryPage";
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

type AiMenu = "models" | "agents" | "reasoning" | "scenarios";
export type AiPage = "chat" | "history";

export type ProjectAiPaneHandle = {
  createConversation: () => void;
  toggleHistory: () => void;
  openScenarioMenu: (anchor: ContextMenuAnchor) => void;
};

type ProjectAiPaneProps = {
  opened: OpenedProject;
  onWorkspaceDirty: () => void;
  page: AiPage;
  onPageChange: (page: AiPage) => void;
  showHeader?: boolean;
};

export const ProjectAiPane = forwardRef<ProjectAiPaneHandle, ProjectAiPaneProps>(
  function ProjectAiPane({ opened, onWorkspaceDirty, page, onPageChange, showHeader = true }, ref) {
    const overlay = useOverlay();
    const ai = useProjectAi(opened, onWorkspaceDirty);
    const composerRef = useRef<AiComposerHandle>(null);
    const scenarioMenuTriggerRef = useRef<ComponentRef<typeof Pressable>>(null);
    const [trigger, setTrigger] = useState<ComposerTrigger | null>(null);
    const [triggerQuery, setTriggerQuery] = useState("");
    const [draft, setDraft] = useState("");
    const [slash, setSlash] = useState<AiChatSlashRef | null>(null);
    const [mentions, setMentions] = useState<AiChatMentionRef[]>([]);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const navigationProgress = useSharedValue(0);

    useEffect(() => {
      navigationProgress.value = withTiming(page === "history" ? 1 : 0, OVERLAY_TIMING);
    }, [navigationProgress, page]);

    const chatAnimatedStyle = useAnimatedStyle(() => ({
      opacity: 1 - navigationProgress.value,
    }));

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
      onPageChange("chat");
      composerRef.current?.clear();
      setDraft("");
      setSlash(null);
      setMentions([]);
      setTrigger(null);
      setTriggerQuery("");
    };

    const handleSelectConversation = (conversationId: string) => {
      if (conversationId !== ai.snapshot.conversationId) {
        ai.switchConversation(conversationId);
      }
      onPageChange("chat");
      composerRef.current?.clear();
      setDraft("");
      setSlash(null);
      setMentions([]);
      clearTrigger();
    };

    const handleEditUser = (message: AiChatUserMessage, editedText: string) => {
      ai.editUserMessage(message.id, {
        text: editedText,
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
    const modelsSettings = getMobileSettings().models.getSnapshot();
    const providerNameByModelId = new Map(
      modelsSettings.models.map((model) => [
        model.id,
        modelsSettings.providers.find((provider) => provider.id === model.providerId)?.name,
      ]),
    );

    const openAiMenu = async (kind: AiMenu, anchor: ContextMenuAnchor) => {
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
                group: providerNameByModelId.get(model.id),
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

    const openAiMenuFromTrigger = (
      kind: AiMenu,
      trigger: ComponentRef<typeof Pressable> | null,
    ) => {
      trigger?.measureInWindow((x, y, width, height) => {
        void openAiMenu(kind, { x, y, width, height });
      });
    };

    useImperativeHandle(ref, () => ({
      createConversation: handleCreate,
      toggleHistory: () => {
        onPageChange(page === "history" ? "chat" : "history");
      },
      openScenarioMenu: (anchor) => {
        void openAiMenu("scenarios", anchor);
      },
    }));

    const headerActions = (
      <>
        {__DEV__ ? (
          <SettingsHeaderButton
            ref={scenarioMenuTriggerRef}
            Icon={IconBeaker}
            label="测试场景"
            onPress={() => {
              openAiMenuFromTrigger("scenarios", scenarioMenuTriggerRef.current);
            }}
          />
        ) : null}
        <SettingsHeaderButton
          Icon={IconHistory}
          label={page === "history" ? "显示当前会话" : "历史会话"}
          onPress={() => {
            onPageChange(page === "history" ? "chat" : "history");
          }}
        />
        <SettingsHeaderButton Icon={IconAdd} label="新建会话" onPress={handleCreate} />
      </>
    );

    return (
      <View
        style={aiStyles.root}
        onTouchStart={() => {
          if (editingMessageId !== null) {
            setEditingMessageId(null);
          }
        }}
      >
        {showHeader ? (
          <View style={[projectPaneStyles.header, aiStyles.header]}>
            <View style={aiStyles.headerTitleWrap}>
              <Text style={aiStyles.title}>AI</Text>
              <Text style={aiStyles.subtitle}>{page === "history" ? "历史会话" : "助手"}</Text>
            </View>
            <View style={aiStyles.headerActions}>{headerActions}</View>
          </View>
        ) : null}

        <View style={aiStyles.pageViewport}>
          <Animated.View
            pointerEvents={page === "chat" ? "auto" : "none"}
            style={[aiStyles.chatPage, chatAnimatedStyle]}
          >
            <AiMessageList
              snapshot={ai.snapshot}
              onRetry={ai.snapshot.canRetry ? ai.retryLastRequest : undefined}
              onContinue={ai.snapshot.canContinue ? ai.continueLastRequest : undefined}
              onSelectBranch={ai.selectMessageBranch}
              onEditUser={handleEditUser}
              editingMessageId={editingMessageId}
              onBeginEdit={setEditingMessageId}
              onCancelEdit={() => {
                setEditingMessageId(null);
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
                        const item = mentionItems.find(
                          (entry) => `${entry.domain}:${entry.id}` === id,
                        );
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
                  onOpenModels={(anchor) => {
                    void openAiMenu("models", anchor);
                  }}
                  onOpenAgents={(anchor) => {
                    void openAiMenu("agents", anchor);
                  }}
                  onOpenReasoning={(anchor) => {
                    void openAiMenu("reasoning", anchor);
                  }}
                  onSend={handleSend}
                  onStop={ai.stopGeneration}
                />
              )}
            </View>
          </Animated.View>
          {page === "history" ? (
            <Animated.View
              entering={FadeIn.duration(OVERLAY_TIMING.duration).easing(OVERLAY_TIMING.easing)}
              exiting={FadeOut.duration(OVERLAY_TIMING.duration).easing(OVERLAY_TIMING.easing)}
              style={StyleSheet.absoluteFill}
            >
              <AiChatHistoryPage ai={ai} onSelectConversation={handleSelectConversation} />
            </Animated.View>
          ) : null}
        </View>
      </View>
    );
  },
);
