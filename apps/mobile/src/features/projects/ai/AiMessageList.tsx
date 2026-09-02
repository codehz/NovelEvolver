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
import { FlatList, Pressable, Text, View } from "react-native";

import { aiStyles } from "./ai-chrome";
import { AiAskUserCard, AiSubagentCard } from "./AiElevatedCards";
import { AiMarkdown } from "./AiMarkdown";
import { AiWorkBlock } from "./AiWorkBlock";

type AiMessageListProps = {
  snapshot: AiChatSnapshot;
  onRetry?: () => void;
  onContinue?: () => void;
  onSelectBranch: (messageId: string, index: number) => void;
  onEditUser: (message: AiChatUserMessage) => void;
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
        <Text style={aiStyles.actionLabel}>‹</Text>
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
        <Text style={aiStyles.actionLabel}>›</Text>
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
  isLast,
  onSelectBranch,
  onEditUser,
}: {
  message: AiChatUserMessage;
  disabled: boolean;
  isLast: boolean;
  onSelectBranch: (index: number) => void;
  onEditUser: () => void;
}) {
  return (
    <View style={aiStyles.userBubble}>
      <Text style={aiStyles.messageText}>
        {formatUserMessageDisplay(message.slash, message.text)}
      </Text>
      {message.mentions.length > 0 ? (
        <Text style={aiStyles.metaText}>
          {message.mentions.map((item) => item.token).join(" ")}
        </Text>
      ) : null}
      <BranchControls message={message} disabled={disabled} onSelectBranch={onSelectBranch} />
      {isLast && !disabled ? (
        <Pressable accessibilityRole="button" accessibilityLabel="编辑消息" onPress={onEditUser}>
          <Text style={aiStyles.actionLabel}>编辑</Text>
        </Pressable>
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
            isLast={index === lastIndex}
            onSelectBranch={(branchIndex) => onSelectBranch(item.id, branchIndex)}
            onEditUser={() => onEditUser(item)}
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
