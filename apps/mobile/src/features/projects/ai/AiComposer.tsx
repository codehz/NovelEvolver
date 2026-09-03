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
  const mentionById = useMemo(
    () => new Map(mentionItems.map((item) => [`${item.domain}:${item.id}`, item])),
    [mentionItems],
  );
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
  const {
    inputProps,
    suggestions,
    plainText: renderedText,
  } = useMention({
    value,
    partTypes,
    onChange: (nextValue, nextParts) => {
      setValue(nextValue);
      const nextText = plainText(nextParts);
      onDraftChange(nextText);
      const activeMentions = nextParts
        .filter((part) => part.data?.trigger === "@")
        .map((part) => {
          const item = mentionById.get(part.data?.id ?? "");
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
      for (const mention of mentions) {
        if (!activeMentions.some((active) => active.token === mention.token)) {
          onRemoveMention(mention.token);
        }
      }
      const nextSlash = nextParts.find((part) => part.data?.trigger === "/")?.data?.id;
      if (nextSlash === undefined && slash !== null) {
        onClearSlash();
      }
    },
  });

  useEffect(() => {
    const slashKeyword = suggestions["/"]?.keyword;
    const mentionKeyword = suggestions["@"]?.keyword;
    if (slashKeyword !== undefined && value.startsWith("/")) {
      onTriggerChange("/", slashKeyword);
    } else if (mentionKeyword !== undefined) {
      onTriggerChange("@", mentionKeyword);
    } else {
      onTriggerChange(null, "");
    }
  }, [onTriggerChange, suggestions]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        inputProps.onChangeText("");
        onDraftChange("");
        onClearSlash();
        for (const mention of mentions) onRemoveMention(mention.token);
        onTriggerChange(null, "");
      },
      focus: () => inputRef.current?.focus(),
      setPrompt: (prompt) => {
        suggestions["/"]?.onSuggestionPress({ id: prompt.promptId });
        onTriggerChange(null, "");
      },
      setMention: (item, token) => {
        mentionLabelOverrides.current.set(`${item.domain}:${item.id}`, token);
        suggestions["@"]?.onSuggestionPress({ id: `${item.domain}:${item.id}` });
        onTriggerChange(null, "");
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
        onClearSlash();
      },
      removeMention: (token) => {
        const mention = mentions.find((item) => item.token === token);
        const nextValue =
          mention === undefined
            ? value
            : value.replace(mentionValue(`${mention.domain}:${mention.id}`, "@"), "");
        inputProps.onChangeText(nextValue);
        onDraftChange(renderedText.replace(token, ""));
        onRemoveMention(token);
      },
      getSendPayload: () => buildComposerSendPayload(renderedText, slash, mentions),
      isEmpty: () => isComposerEmpty(renderedText, slash, mentions),
    }),
    [
      inputProps,
      mentions,
      onClearSlash,
      onDraftChange,
      onRemoveMention,
      onTriggerChange,
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
          style={aiStyles.input}
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
            <Text style={aiStyles.selectorLabel}>{selectedAgent?.name ?? "Agent"}</Text>
          </Pressable>
          <Pressable
            ref={modelMenuTriggerRef}
            collapsable={false}
            style={aiStyles.selectorButton}
            onPress={() => openMenuFromTrigger(modelMenuTriggerRef.current, onOpenModels)}
            disabled={composerDisabled}
          >
            <Text style={aiStyles.selectorLabel}>{selectedModel?.name ?? "模型"}</Text>
          </Pressable>
          {showReasoning ? (
            <Pressable
              ref={reasoningMenuTriggerRef}
              collapsable={false}
              style={aiStyles.selectorButton}
              onPress={() => openMenuFromTrigger(reasoningMenuTriggerRef.current, onOpenReasoning)}
              disabled={composerDisabled}
            >
              <Text style={aiStyles.selectorLabel}>
                {snapshot.selectedReasoningLevel
                  ? AI_REASONING_LEVEL_LABELS[snapshot.selectedReasoningLevel as AiReasoningLevel]
                  : "推理"}
              </Text>
            </Pressable>
          ) : null}
          {snapshot.pending ? (
            <Pressable style={aiStyles.sendButton} onPress={onStop}>
              <Text style={aiStyles.sendLabel}>停止</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[aiStyles.sendButton, canSend ? null : aiStyles.sendButtonDisabled]}
              disabled={!canSend}
              onPress={onSend}
            >
              <Text style={aiStyles.sendLabel}>发送</Text>
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardGestureArea>
  );
}
