import { formatUserMessageDisplay } from "@novelevolver/ai-runtime";
import type {
  AiChatAssistantMessage,
  AiChatMessage,
  AiChatSnapshot,
  AiChatUserMessage,
} from "@novelevolver/domain/ai";
import { useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";

import { aiStyles } from "./ai-chrome";
import { formatToolCall } from "./tool-summary";

type AiMessageListProps = {
  snapshot: AiChatSnapshot;
  onRetry?: () => void;
  onContinue?: () => void;
  onSelectBranch: (messageId: string, index: number) => void;
  onEditUser: (message: AiChatUserMessage) => void;
};

function usageLine(message: AiChatAssistantMessage): string | null {
  const usage = message.usage;
  if (usage == null) {
    return null;
  }
  const parts: string[] = [];
  if (usage.lastInputTokens != null) {
    parts.push(`上下文 ${usage.lastInputTokens}`);
  } else if (usage.inputTokens != null) {
    parts.push(`输入 ${usage.inputTokens}`);
  }
  if (usage.outputTokens != null) {
    parts.push(`输出 ${usage.outputTokens}`);
  }
  if (usage.reasoningTokens != null) {
    parts.push(`推理 ${usage.reasoningTokens}`);
  }
  if (parts.length === 0) {
    return null;
  }
  return [message.modelName, ...parts].filter((part) => part !== "").join(" · ");
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
  if (message.branch == null || message.branch.count <= 1) {
    return null;
  }
  const { index, count } = message.branch;
  return (
    <View style={aiStyles.rowActions}>
      <Pressable
        disabled={disabled || index <= 0}
        onPress={() => {
          onSelectBranch(index - 1);
        }}
      >
        <Text style={aiStyles.actionLabel}>‹</Text>
      </Pressable>
      <Text style={aiStyles.metaText}>
        {index + 1}/{count}
      </Text>
      <Pressable
        disabled={disabled || index >= count - 1}
        onPress={() => {
          onSelectBranch(index + 1);
        }}
      >
        <Text style={aiStyles.actionLabel}>›</Text>
      </Pressable>
    </View>
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
        <Pressable onPress={onEditUser}>
          <Text style={aiStyles.actionLabel}>编辑</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AssistantMessage({
  message,
  isLast,
  canRetry,
  canContinue,
  disabled,
  onRetry,
  onContinue,
  onSelectBranch,
}: {
  message: AiChatAssistantMessage;
  isLast: boolean;
  canRetry: boolean;
  canContinue: boolean;
  disabled: boolean;
  onRetry?: () => void;
  onContinue?: () => void;
  onSelectBranch: (index: number) => void;
}) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const usage = usageLine(message);
  return (
    <View style={aiStyles.assistantBlock}>
      {message.parts.map((part) => {
        if (part.type === "reasoning") {
          return (
            <Pressable
              key={part.id}
              style={aiStyles.partCard}
              onPress={() => {
                setReasoningOpen((value) => !value);
              }}
            >
              <Text style={aiStyles.partTitle}>
                思考{part.status === "streaming" ? "中…" : ""} {reasoningOpen ? "▾" : "▸"}
              </Text>
              {reasoningOpen ? <Text style={aiStyles.messageText}>{part.text || "…"}</Text> : null}
            </Pressable>
          );
        }
        if (part.type === "tool_call") {
          return (
            <View key={part.id} style={aiStyles.partCard}>
              <Text style={aiStyles.partTitle}>工具</Text>
              <Text style={aiStyles.messageText}>{formatToolCall(part)}</Text>
            </View>
          );
        }
        return (
          <Text key={part.id} style={aiStyles.messageText}>
            {part.text || (part.status === "streaming" ? "…" : "")}
          </Text>
        );
      })}
      {usage ? <Text style={aiStyles.metaText}>{usage}</Text> : null}
      <BranchControls message={message} disabled={disabled} onSelectBranch={onSelectBranch} />
      {isLast && !disabled ? (
        <View style={aiStyles.rowActions}>
          {canRetry && onRetry ? (
            <Pressable onPress={onRetry}>
              <Text style={aiStyles.actionLabel}>重试</Text>
            </Pressable>
          ) : null}
          {canContinue && onContinue ? (
            <Pressable onPress={onContinue}>
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
      renderItem={({ item, index }) => {
        const isLast = index === lastIndex;
        if (item.role === "user") {
          return (
            <UserMessage
              message={item}
              disabled={disabled}
              isLast={isLast}
              onSelectBranch={(branchIndex) => {
                onSelectBranch(item.id, branchIndex);
              }}
              onEditUser={() => {
                onEditUser(item);
              }}
            />
          );
        }
        return (
          <AssistantMessage
            message={item}
            isLast={isLast}
            canRetry={isLast && snapshot.canRetry}
            canContinue={isLast && snapshot.canContinue}
            disabled={disabled}
            onRetry={onRetry}
            onContinue={onContinue}
            onSelectBranch={(branchIndex) => {
              onSelectBranch(item.id, branchIndex);
            }}
          />
        );
      }}
    />
  );
}
