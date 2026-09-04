import { formatUserMessageDisplay } from "@novelevolver/ai-runtime";
import type {
  AiChatAssistantMessage,
  AiChatMessage,
  AiChatSnapshot,
  AiChatUserMessage,
} from "@novelevolver/domain/ai";
import {
  isWorkSegmentLive,
  projectAssistantSegments,
  shouldKeepWorkExpanded,
  type AssistantSegment,
} from "@novelevolver/domain/ai";
import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import IconChevronLeft from "~icons/codicon/chevron-left";
import IconChevronRight from "~icons/codicon/chevron-right";

import { color } from "../../../shared/theme";
import { aiStyles } from "./ai-chrome";
import { AiAskUserCard, AiSubagentCard } from "./AiElevatedCards";
import { AiMarkdown } from "./AiMarkdown";
import { AiWorkBlock } from "./AiWorkBlock";

type AiMessageListProps = {
  snapshot: AiChatSnapshot;
  onRetry?: () => void;
  onContinue?: () => void;
  onSelectBranch: (messageId: string, index: number) => void;
  onEditUser: (message: AiChatUserMessage, text: string) => void;
  editingMessageId: string | null;
  onBeginEdit: (messageId: string) => void;
  onCancelEdit: () => void;
};

function usageLine(message: AiChatAssistantMessage): string | null {
  const usage = message.usage;
  if (usage == null) return null;
  const parts = [
    usage.lastInputTokens != null
      ? `上下文 ${usage.lastInputTokens}`
      : usage.inputTokens != null
        ? `输入 ${usage.inputTokens}`
        : null,
    usage.outputTokens != null ? `输出 ${usage.outputTokens}` : null,
    usage.reasoningTokens != null ? `推理 ${usage.reasoningTokens}` : null,
  ].filter((part): part is string => part != null);
  return parts.length === 0 ? null : [message.modelName, ...parts].filter(Boolean).join(" · ");
}

function BranchControls({
  message,
  disabled,
  onSelectBranch,
}: {
  message: AiChatMessage;
  disabled: boolean;
  onSelectBranch: (index: number) => void;
}) {
  if (message.branch == null || message.branch.count <= 1) return null;
  const { index, count } = message.branch;
  return (
    <View style={aiStyles.rowActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="上一分支"
        disabled={disabled || index <= 0}
        onPress={() => onSelectBranch(index - 1)}
      >
        <IconChevronLeft width={16} height={16} color={color.accent} />
      </Pressable>
      <Text style={aiStyles.metaText}>
        {index + 1}/{count}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="下一分支"
        disabled={disabled || index >= count - 1}
        onPress={() => onSelectBranch(index + 1)}
      >
        <IconChevronRight width={16} height={16} color={color.accent} />
      </Pressable>
    </View>
  );
}

function renderSegment(segment: AssistantSegment, index: number, message: AiChatAssistantMessage) {
  if (segment.kind === "prose")
    return (
      <AiMarkdown
        key={segment.id}
        content={segment.part.text}
        streaming={segment.part.status === "streaming"}
      />
    );
  if (segment.kind === "work") {
    const keepExpanded = shouldKeepWorkExpanded({
      isStepsLive: isWorkSegmentLive(segment.steps),
      messageStreaming: message.status === "streaming",
      isLastSegment: index === projectAssistantSegments(message.parts).length - 1,
    });
    return (
      <AiWorkBlock
        key={segment.id}
        id={segment.id}
        steps={segment.steps}
        keepExpanded={keepExpanded}
      />
    );
  }
  return segment.kind === "subagent" ? (
    <AiSubagentCard key={segment.id} toolCall={segment.part} />
  ) : (
    <AiAskUserCard key={segment.id} toolCall={segment.part} />
  );
}

function UserMessage({
  message,
  disabled,
  onSelectBranch,
  onEditUser,
  editing,
  onBeginEdit,
  onCancelEdit,
}: {
  message: AiChatUserMessage;
  disabled: boolean;
  onSelectBranch: (index: number) => void;
  onEditUser: (text: string) => void;
  editing: boolean;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
}) {
  const [draft, setDraft] = useState(message.text);

  function beginEdit(): void {
    if (disabled) return;
    setDraft(message.text);
    onBeginEdit();
  }

  function cancelEdit(): void {
    setDraft(message.text);
    onCancelEdit();
  }

  function commitEdit(): void {
    const next = draft;
    onCancelEdit();
    if (next.trim() !== "" && next !== message.text) {
      onEditUser(next);
    }
  }

  return (
    <View style={aiStyles.userMessageRow}>
      {editing ? (
        <View
          style={aiStyles.userBubble}
          onTouchStart={(event) => {
            event.stopPropagation();
          }}
        >
          <TextInput
            autoFocus
            multiline
            value={draft}
            onChangeText={setDraft}
            style={aiStyles.userEditInput}
            selectionColor={color.accent}
          />
          <View style={aiStyles.rowActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="取消编辑"
              onPress={cancelEdit}
            >
              <Text style={aiStyles.actionLabel}>取消</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="保存并发送"
              disabled={draft.trim() === ""}
              onPress={commitEdit}
            >
              <Text
                style={[aiStyles.actionLabel, draft.trim() === "" && aiStyles.disabledActionLabel]}
              >
                保存并发送
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="编辑消息"
          accessibilityHint="长按编辑此消息"
          disabled={disabled}
          onLongPress={beginEdit}
          style={aiStyles.userBubble}
        >
          <Text style={aiStyles.messageText}>
            {formatUserMessageDisplay(message.slash, message.text)}
          </Text>
          {message.mentions.length > 0 ? (
            <Text style={aiStyles.metaText}>
              {message.mentions.map((item) => item.token).join(" ")}
            </Text>
          ) : null}
        </Pressable>
      )}
      {!editing ? (
        <BranchControls message={message} disabled={disabled} onSelectBranch={onSelectBranch} />
      ) : null}
    </View>
  );
}

function AssistantMessage({
  message,
  isLast,
  disabled,
  onRetry,
  onContinue,
  onSelectBranch,
}: {
  message: AiChatAssistantMessage;
  isLast: boolean;
  disabled: boolean;
  onRetry?: () => void;
  onContinue?: () => void;
  onSelectBranch: (index: number) => void;
}) {
  const segments = projectAssistantSegments(message.parts);
  const usage = usageLine(message);
  return (
    <View style={aiStyles.assistantBlock}>
      {segments.map((segment, index) => renderSegment(segment, index, message))}
      {usage ? <Text style={aiStyles.metaText}>{usage}</Text> : null}
      <BranchControls message={message} disabled={disabled} onSelectBranch={onSelectBranch} />
      {isLast && !disabled ? (
        <View style={aiStyles.rowActions}>
          {onRetry ? (
            <Pressable accessibilityRole="button" accessibilityLabel="重新生成" onPress={onRetry}>
              <Text style={aiStyles.actionLabel}>重试</Text>
            </Pressable>
          ) : null}
          {onContinue ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="继续会话"
              onPress={onContinue}
            >
              <Text style={aiStyles.actionLabel}>继续</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function AiMessageList({
  snapshot,
  onRetry,
  onContinue,
  onSelectBranch,
  onEditUser,
  editingMessageId,
  onBeginEdit,
  onCancelEdit,
}: AiMessageListProps) {
  const lastIndex = snapshot.messages.length - 1;
  const disabled = snapshot.pending || snapshot.openInteractions.length > 0;
  return (
    <FlatList
      style={aiStyles.list}
      contentContainerStyle={aiStyles.listContent}
      data={snapshot.messages}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<Text style={aiStyles.empty}>发送一条消息开始对话。</Text>}
      ListHeaderComponent={
        snapshot.warnings.length > 0 ? (
          <View style={aiStyles.warningBanner}>
            {snapshot.warnings.map((warning) => (
              <Text key={warning.id} style={aiStyles.warningText}>
                {warning.message}
              </Text>
            ))}
          </View>
        ) : undefined
      }
      ListFooterComponent={
        snapshot.errorMessage ? (
          <View style={aiStyles.banner}>
            <Text style={aiStyles.bannerText}>{snapshot.errorMessage}</Text>
          </View>
        ) : undefined
      }
      renderItem={({ item, index }) =>
        item.role === "user" ? (
          <UserMessage
            message={item}
            disabled={disabled}
            onSelectBranch={(branchIndex) => onSelectBranch(item.id, branchIndex)}
            onEditUser={(text) => onEditUser(item, text)}
            editing={editingMessageId === item.id}
            onBeginEdit={() => onBeginEdit(item.id)}
            onCancelEdit={onCancelEdit}
          />
        ) : (
          <AssistantMessage
            message={item}
            isLast={index === lastIndex}
            disabled={disabled}
            onRetry={onRetry}
            onContinue={onContinue}
            onSelectBranch={(branchIndex) => onSelectBranch(item.id, branchIndex)}
          />
        )
      }
    />
  );
}
