import type {
  AiChatMentionRef,
  AiChatSelectableAgent,
  AiChatSelectableModel,
  AiChatSendMessageInput,
  AiChatSlashRef,
  AiChatSnapshot,
} from "@novelevolver/domain/ai";
import {
  AI_REASONING_LEVEL_LABELS,
  type AiReasoningLevel,
} from "@novelevolver/domain/settings/ai-settings";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type Ref,
} from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { TextInput as TextInputType } from "react-native";
import { Input, useMention, type MentionPartType, type Part } from "react-native-headless-mention";
import { KeyboardGestureArea } from "react-native-keyboard-controller";
import IconArrowUp from "~icons/codicon/arrow-up";
import IconDebugStop from "~icons/codicon/debug-stop";

import { color } from "../../../shared/theme";
import type { ContextMenuAnchor } from "../../../shared/ui/context-menu-position";
import { aiStyles } from "./ai-chrome";
import { buildComposerSendPayload, isComposerEmpty, type ComposerTrigger } from "./composer-query";
import type { MentionCatalogItem } from "./mention-catalog";

export type AiComposerHandle = {
  clear: () => void;
  focus: () => void;
  setPrompt: (prompt: AiChatSlashRef) => void;
  setMention: (item: MentionCatalogItem, token: string) => void;
  clearPrompt: () => void;
  removeMention: (token: string) => void;
  getSendPayload: () => AiChatSendMessageInput;
  isEmpty: () => boolean;
};

type AiComposerProps = {
  ref?: Ref<AiComposerHandle | null>;
  snapshot: AiChatSnapshot;
  models: AiChatSelectableModel[];
  agents: AiChatSelectableAgent[];
  prompts: readonly AiChatSlashRef[];
  mentionItems: readonly MentionCatalogItem[];
  draft: string;
  slash: AiChatSlashRef | null;
  mentions: readonly AiChatMentionRef[];
  onDraftChange: (value: string) => void;
  onTriggerChange: (indicator: ComposerTrigger | null, query: string) => void;
  onClearSlash: () => void;
  onRemoveMention: (token: string) => void;
  onOpenModels: (anchor: ContextMenuAnchor) => void;
  onOpenAgents: (anchor: ContextMenuAnchor) => void;
  onOpenReasoning: (anchor: ContextMenuAnchor) => void;
  onSend: () => void;
  onStop: () => void;
};

function mentionValue(id: string, trigger: string): string {
  return `<${trigger}${id}>`;
}

function plainText(parts: readonly Part[]): string {
  return parts.map((part) => part.text).join("");
}

export function AiComposer({
  ref,
  snapshot,
  models,
  agents,
  prompts,
  mentionItems,
  draft,
  slash,
  mentions,
  onDraftChange,
  onTriggerChange,
  onClearSlash,
  onRemoveMention,
  onOpenModels,
  onOpenAgents,
  onOpenReasoning,
  onSend,
  onStop,
}: AiComposerProps) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const agentMenuTriggerRef = useRef<ComponentRef<typeof Pressable>>(null);
  const modelMenuTriggerRef = useRef<ComponentRef<typeof Pressable>>(null);
  const reasoningMenuTriggerRef = useRef<ComponentRef<typeof Pressable>>(null);
  const mentionLabelOverrides = useRef(new Map<string, string>());
  const [value, setValue] = useState(draft);
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  const onTriggerChangeRef = useRef(onTriggerChange);
  onTriggerChangeRef.current = onTriggerChange;
  const onClearSlashRef = useRef(onClearSlash);
  onClearSlashRef.current = onClearSlash;
  const onRemoveMentionRef = useRef(onRemoveMention);
  onRemoveMentionRef.current = onRemoveMention;
  const mentionsRef = useRef(mentions);
  mentionsRef.current = mentions;
  const slashRef = useRef(slash);
  slashRef.current = slash;
  const mentionById = useMemo(
    () => new Map(mentionItems.map((item) => [`${item.domain}:${item.id}`, item])),
    [mentionItems],
  );
  const mentionByIdRef = useRef(mentionById);
  mentionByIdRef.current = mentionById;
  const promptById = useMemo(
    () => new Map(prompts.map((prompt) => [prompt.promptId, prompt])),
    [prompts],
  );
  const partTypes = useMemo<MentionPartType[]>(
    () => [
      {
        trigger: "/",
        pattern: /<(?<trigger>\/)(?<id>[^>]+)>/g,
        getLabel: ({ id }) => `/${promptById.get(id)?.slug ?? id}`,
        textStyle: { color: color.accent },
      },
      {
        trigger: "@",
        allowedSpacesCount: 0,
        pattern: /<(?<trigger>@)(?<id>[^>]+)>/g,
        getLabel: ({ id }) =>
          mentionLabelOverrides.current.get(id) ??
          `@${mentionById.get(id)?.displayPath || mentionById.get(id)?.label || id}`,
        textStyle: { color: color.accent },
      },
    ],
    [mentionById, promptById],
  );
  const handleMentionChange = useCallback((nextValue: string, nextParts: readonly Part[]) => {
    setValue(nextValue);
    const nextText = plainText(nextParts);
    onDraftChangeRef.current(nextText);
    const activeMentions = nextParts
      .filter((part) => part.data?.trigger === "@")
      .map((part) => {
        const item = mentionByIdRef.current.get(part.data?.id ?? "");
        return item
          ? {
              domain: item.domain,
              id: item.id,
              kind: item.kind,
              label: item.label,
              displayPath: item.displayPath,
              token: part.text,
            }
          : null;
      })
      .filter((item): item is AiChatMentionRef => item !== null);
    for (const mention of mentionsRef.current) {
      if (!activeMentions.some((active) => active.token === mention.token)) {
        onRemoveMentionRef.current(mention.token);
      }
    }
    const nextSlash = nextParts.find((part) => part.data?.trigger === "/")?.data?.id;
    if (nextSlash === undefined && slashRef.current !== null) {
      onClearSlashRef.current();
    }
  }, []);
  const {
    inputProps,
    suggestions,
    plainText: renderedText,
  } = useMention({
    value,
    partTypes,
    onChange: handleMentionChange,
  });

  const slashKeyword = suggestions["/"]?.keyword;
  const mentionKeyword = suggestions["@"]?.keyword;
  useEffect(() => {
    if (slashKeyword !== undefined && value.startsWith("/")) {
      onTriggerChangeRef.current("/", slashKeyword);
    } else if (mentionKeyword !== undefined) {
      onTriggerChangeRef.current("@", mentionKeyword);
    } else {
      onTriggerChangeRef.current(null, "");
    }
  }, [mentionKeyword, slashKeyword, value]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        inputProps.onChangeText("");
        onDraftChangeRef.current("");
        onClearSlashRef.current();
        for (const mention of mentions) onRemoveMentionRef.current(mention.token);
        onTriggerChangeRef.current(null, "");
      },
      focus: () => inputRef.current?.focus(),
      setPrompt: (prompt) => {
        suggestions["/"]?.onSuggestionPress({ id: prompt.promptId });
        onTriggerChangeRef.current(null, "");
      },
      setMention: (item, token) => {
        mentionLabelOverrides.current.set(`${item.domain}:${item.id}`, token);
        suggestions["@"]?.onSuggestionPress({ id: `${item.domain}:${item.id}` });
        onTriggerChangeRef.current(null, "");
      },
      clearPrompt: () => {
        if (slash !== null) {
          const prompt = promptById.get(slash.promptId);
          const rawMarker =
            prompt === undefined
              ? mentionValue(slash.promptId, "/")
              : mentionValue(prompt.promptId, "/");
          const nextValue = value.startsWith(rawMarker) ? value.slice(rawMarker.length) : value;
          inputProps.onChangeText(nextValue);
        }
        onClearSlashRef.current();
      },
      removeMention: (token) => {
        const mention = mentions.find((item) => item.token === token);
        const nextValue =
          mention === undefined
            ? value
            : value.replace(mentionValue(`${mention.domain}:${mention.id}`, "@"), "");
        inputProps.onChangeText(nextValue);
        onDraftChangeRef.current(renderedText.replace(token, ""));
        onRemoveMentionRef.current(token);
      },
      getSendPayload: () => buildComposerSendPayload(renderedText, slash, mentions),
      isEmpty: () => isComposerEmpty(renderedText, slash, mentions),
    }),
    [
      inputProps,
      mentions,
      onClearSlashRef,
      onDraftChangeRef,
      onRemoveMentionRef,
      onTriggerChangeRef,
      promptById,
      renderedText,
      slash,
      suggestions,
      value,
    ],
  );

  const selectedModel = models.find((model) => model.id === snapshot.selectedModelId);
  const selectedAgent = agents.find((agent) => agent.id === snapshot.selectedAgentId);
  const showReasoning = (selectedModel?.availableReasoningLevels.length ?? 0) > 0;
  const composerDisabled = snapshot.pending || snapshot.openInteractions.length > 0;
  const canSend = !composerDisabled && !isComposerEmpty(renderedText, slash, mentions);
  const openMenuFromTrigger = (
    trigger: ComponentRef<typeof Pressable> | null,
    onOpen: (anchor: ContextMenuAnchor) => void,
  ) => {
    trigger?.measureInWindow((x, y, width, height) => {
      onOpen({ x, y, width, height });
    });
  };

  return (
    <KeyboardGestureArea interpolator="ios" enableSwipeToDismiss>
      <View style={aiStyles.composer}>
        <Input
          {...inputProps}
          inputRef={inputRef as unknown as Ref<TextInputType>}
          editable={!composerDisabled}
          placeholder={slash != null ? "补充说明（可选）…" : "输入消息…"}
          placeholderTextColor={color.placeholder}
          cursorColor={color.accent}
          selectionColor={color.accent}
          scrollEnabled
          multiline
          submitBehavior="newline"
          style={aiStyles.composerInput}
          onSubmitEditing={onSend}
        />
        <View style={aiStyles.composerToolbar}>
          <Pressable
            ref={agentMenuTriggerRef}
            collapsable={false}
            style={aiStyles.selectorButton}
            onPress={() => openMenuFromTrigger(agentMenuTriggerRef.current, onOpenAgents)}
            disabled={composerDisabled}
          >
            <Text style={aiStyles.selectorLabel} numberOfLines={1} ellipsizeMode="tail">
              {selectedAgent?.name ?? "Agent"}
            </Text>
          </Pressable>
          <Pressable
            ref={modelMenuTriggerRef}
            collapsable={false}
            style={aiStyles.selectorButton}
            onPress={() => openMenuFromTrigger(modelMenuTriggerRef.current, onOpenModels)}
            disabled={composerDisabled}
          >
            <Text style={aiStyles.selectorLabel} numberOfLines={1} ellipsizeMode="tail">
              {selectedModel?.name ?? "模型"}
            </Text>
          </Pressable>
          {showReasoning ? (
            <Pressable
              ref={reasoningMenuTriggerRef}
              collapsable={false}
              style={aiStyles.selectorButton}
              onPress={() => openMenuFromTrigger(reasoningMenuTriggerRef.current, onOpenReasoning)}
              disabled={composerDisabled}
            >
              <Text style={aiStyles.selectorLabel} numberOfLines={1} ellipsizeMode="tail">
                {snapshot.selectedReasoningLevel
                  ? AI_REASONING_LEVEL_LABELS[snapshot.selectedReasoningLevel as AiReasoningLevel]
                  : "推理"}
              </Text>
            </Pressable>
          ) : null}
          {snapshot.pending ? (
            <Pressable
              accessibilityLabel="停止生成"
              accessibilityRole="button"
              style={aiStyles.sendButton}
              onPress={onStop}
            >
              <IconDebugStop width={18} height={18} color={color.primaryForeground} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel="发送"
              accessibilityRole="button"
              style={[aiStyles.sendButton, canSend ? null : aiStyles.sendButtonDisabled]}
              disabled={!canSend}
              onPress={onSend}
            >
              <IconArrowUp width={18} height={18} color={color.primaryForeground} />
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardGestureArea>
  );
}
