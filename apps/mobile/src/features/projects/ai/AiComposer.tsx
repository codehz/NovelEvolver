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
import { useImperativeHandle, useRef, type Ref } from "react";
import { Pressable, Text, View } from "react-native";
import type { EnrichedTextInputInstance } from "react-native-enriched-html";
import { EnrichedTextInput } from "react-native-enriched-html";

import { color } from "../../../shared/theme";
import { aiStyles } from "./ai-chrome";
import { buildComposerSendPayload, isComposerEmpty, type ComposerTrigger } from "./composer-query";
import type { MentionCatalogItem } from "./mention-catalog";

export type AiComposerHandle = {
  clear: () => void;
  focus: () => void;
  startMention: (indicator: ComposerTrigger) => void;
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
  draft: string;
  slash: AiChatSlashRef | null;
  mentions: readonly AiChatMentionRef[];
  onDraftChange: (value: string) => void;
  onTriggerChange: (indicator: ComposerTrigger | null, query: string) => void;
  onClearSlash: () => void;
  onRemoveMention: (token: string) => void;
  onOpenModels: () => void;
  onOpenAgents: () => void;
  onOpenReasoning: () => void;
  onOpenPrompts: () => void;
  onOpenMentions: () => void;
  onSend: () => void;
  onStop: () => void;
};

export function AiComposer({
  ref,
  snapshot,
  models,
  agents,
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
  onOpenPrompts,
  onOpenMentions,
  onSend,
  onStop,
}: AiComposerProps) {
  const inputRef = useRef<EnrichedTextInputInstance>(null);
  const selectedModel = models.find((model) => model.id === snapshot.selectedModelId);
  const selectedAgent = agents.find((agent) => agent.id === snapshot.selectedAgentId);
  const showReasoning = (selectedModel?.availableReasoningLevels.length ?? 0) > 0;
  const composerDisabled = snapshot.pending || snapshot.openInteractions.length > 0;

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        inputRef.current?.setValue("");
        onDraftChange("");
        onClearSlash();
        for (const mention of mentions) {
          onRemoveMention(mention.token);
        }
        onTriggerChange(null, "");
      },
      focus: () => inputRef.current?.focus(),
      startMention: (indicator) => {
        inputRef.current?.focus();
        if (indicator === "/") {
          inputRef.current?.setSelection(0, 0);
        }
        inputRef.current?.startMention(indicator);
      },
      setPrompt: (prompt) => {
        inputRef.current?.setMention("/", `/${prompt.slug}`, {
          "data-prompt-id": prompt.promptId,
          "data-slug": prompt.slug,
          "data-title": prompt.title,
          "data-body": prompt.body,
        });
        onClearSlash();
        onTriggerChange(null, "");
      },
      setMention: (item, token) => {
        inputRef.current?.setMention("@", token, {
          "data-domain": item.domain,
          "data-id": item.id,
          "data-kind": item.kind,
          "data-label": item.label,
          "data-display-path": item.displayPath,
        });
        onTriggerChange(null, "");
      },
      clearPrompt: () => {
        const value = draft;
        const marker = slash === null ? "" : `/${slash.slug}`;
        if (marker !== "" && value.startsWith(marker)) {
          inputRef.current?.setValue(value.slice(marker.length));
          onDraftChange(value.slice(marker.length));
        }
        onClearSlash();
      },
      removeMention: (token) => {
        const next = draft.replace(token, "");
        inputRef.current?.setValue(next);
        onDraftChange(next);
        onRemoveMention(token);
      },
      getSendPayload: () => buildComposerSendPayload(draft, slash, mentions),
      isEmpty: () => isComposerEmpty(draft, slash, mentions),
    }),
    [draft, mentions, onClearSlash, onDraftChange, onRemoveMention, onTriggerChange, slash],
  );

  const canSend = !composerDisabled && !isComposerEmpty(draft, slash, mentions);

  return (
    <View style={aiStyles.composer}>
      <EnrichedTextInput
        ref={inputRef}
        mentionIndicators={["/", "@"]}
        editable={!composerDisabled}
        placeholder={slash != null ? "补充说明（可选）…" : "输入消息…"}
        placeholderTextColor={color.placeholder}
        cursorColor={color.accent}
        selectionColor={color.accent}
        scrollEnabled
        submitBehavior="newline"
        style={aiStyles.input}
        onChangeText={(event) => {
          const value = event.nativeEvent.value;
          onDraftChange(value);
          const activeMentions = mentions.filter((mention) => value.includes(mention.token));
          for (const mention of mentions) {
            if (!activeMentions.some((active) => active.token === mention.token)) {
              onRemoveMention(mention.token);
            }
          }
        }}
        onStartMention={(indicator) => {
          // Slash commands are available only when the draft is empty before `/`.
          if (indicator === "/" && draft !== "") {
            onTriggerChange(null, "");
            return;
          }
          onTriggerChange(indicator as ComposerTrigger, "");
        }}
        onChangeMention={(event) => {
          onTriggerChange(event.indicator as ComposerTrigger, event.text);
        }}
        onEndMention={(indicator) => {
          onTriggerChange(null, "");
          if (indicator === "/" && slash === null) {
            onClearSlash();
          }
        }}
        onSubmitEditing={onSend}
      />
      <View style={aiStyles.composerToolbar}>
        <Pressable
          style={aiStyles.selectorButton}
          onPress={onOpenAgents}
          disabled={composerDisabled}
        >
          <Text style={aiStyles.selectorLabel}>{selectedAgent?.name ?? "Agent"}</Text>
        </Pressable>
        <Pressable
          style={aiStyles.selectorButton}
          onPress={onOpenModels}
          disabled={composerDisabled}
        >
          <Text style={aiStyles.selectorLabel}>{selectedModel?.name ?? "模型"}</Text>
        </Pressable>
        {showReasoning ? (
          <Pressable
            style={aiStyles.selectorButton}
            onPress={onOpenReasoning}
            disabled={composerDisabled}
          >
            <Text style={aiStyles.selectorLabel}>
              {snapshot.selectedReasoningLevel
                ? AI_REASONING_LEVEL_LABELS[snapshot.selectedReasoningLevel as AiReasoningLevel]
                : "推理"}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={aiStyles.selectorButton}
          onPress={onOpenPrompts}
          disabled={composerDisabled}
        >
          <Text style={aiStyles.selectorLabel}>/</Text>
        </Pressable>
        <Pressable
          style={aiStyles.selectorButton}
          onPress={onOpenMentions}
          disabled={composerDisabled}
        >
          <Text style={aiStyles.selectorLabel}>@</Text>
        </Pressable>
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
  );
}
