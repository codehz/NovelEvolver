import type {
  AiChatMentionRef,
  AiChatSelectableAgent,
  AiChatSelectableModel,
  AiChatSlashRef,
  AiChatSnapshot,
} from "@novelevolver/domain/ai";
import {
  AI_REASONING_LEVEL_LABELS,
  type AiReasoningLevel,
} from "@novelevolver/domain/settings/ai-settings";
import { Pressable, Text, TextInput, View } from "react-native";

import { color } from "../../../shared/theme";
import { aiStyles } from "./ai-chrome";

type AiComposerProps = {
  snapshot: AiChatSnapshot;
  models: AiChatSelectableModel[];
  agents: AiChatSelectableAgent[];
  draft: string;
  slash: AiChatSlashRef | null;
  mentions: readonly AiChatMentionRef[];
  onDraftChange: (value: string) => void;
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
  snapshot,
  models,
  agents,
  draft,
  slash,
  mentions,
  onDraftChange,
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
  const selectedModel = models.find((model) => model.id === snapshot.selectedModelId);
  const selectedAgent = agents.find((agent) => agent.id === snapshot.selectedAgentId);
  const showReasoning = (selectedModel?.availableReasoningLevels.length ?? 0) > 0;
  const canSend =
    !snapshot.pending &&
    snapshot.openInteractions.length === 0 &&
    (slash != null || mentions.length > 0 || draft.trim() !== "");
  const composerDisabled = snapshot.pending || snapshot.openInteractions.length > 0;

  return (
    <View style={aiStyles.composer}>
      {slash != null || mentions.length > 0 ? (
        <View style={aiStyles.chipRow}>
          {slash != null ? (
            <Pressable style={aiStyles.chip} onPress={onClearSlash}>
              <Text style={aiStyles.chipText}>/{slash.slug} ×</Text>
            </Pressable>
          ) : null}
          {mentions.map((mention) => (
            <Pressable
              key={mention.token}
              style={aiStyles.chip}
              onPress={() => {
                onRemoveMention(mention.token);
              }}
            >
              <Text style={aiStyles.chipText}>{mention.token} ×</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        multiline
        value={draft}
        onChangeText={onDraftChange}
        editable={!composerDisabled}
        placeholder={slash != null ? "补充说明（可选）…" : "输入消息…"}
        placeholderTextColor={color.placeholder}
        style={aiStyles.input}
        textAlignVertical="top"
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
