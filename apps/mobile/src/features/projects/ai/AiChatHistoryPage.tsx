import type { AiConversationSummary } from "@novelevolver/domain/ai";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, SectionList, Text, TextInput, View } from "react-native";
import IconCheck from "~icons/codicon/check";
import IconEllipsis from "~icons/codicon/ellipsis";

import { color } from "../../../shared/theme";
import type { ContextMenuAnchor } from "../../../shared/ui/context-menu-position";
import { useOverlay } from "../../../shared/ui/OverlayHost";
import { errorMessage } from "../error-message";
import {
  buildHistorySections,
  conversationBadges,
  conversationTitle,
  formatRelativeTime,
  type AiChatHistoryItem,
} from "./ai-chat-history-model";
import { aiStyles } from "./ai-chrome";
import type { ProjectAiModel } from "./use-project-ai";

const SEARCH_DEBOUNCE_MS = 180;

type AiChatHistoryPageProps = {
  ai: ProjectAiModel;
  onSelectConversation: (conversationId: string) => void;
};

export function AiChatHistoryPage({ ai, onSelectConversation }: AiChatHistoryPageProps) {
  const overlay = useOverlay();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const normalizedQuery = debouncedQuery.trim();
  const isSearching = normalizedQuery !== "";
  const conversations = isSearching
    ? ai.searchConversations(normalizedQuery, includeArchived)
    : includeArchived
      ? ai.conversations
      : ai.conversations.filter((conversation) => conversation.status !== "archived");
  const sections = buildHistorySections(conversations, isSearching);
  const itemCount = sections.reduce((count, section) => count + section.data.length, 0);

  const handleRename = async (conversation: AiConversationSummary) => {
    const title = await overlay.prompt({
      title: "重命名会话",
      initialValue: conversation.title,
      confirmLabel: "保存",
    });
    if (title === null) return;
    try {
      ai.renameConversation(conversation.id, title);
    } catch (error) {
      await overlay.alert({ title: "重命名失败", message: errorMessage(error) });
    }
  };

  const handleDelete = async (conversation: AiConversationSummary) => {
    const confirmed = await overlay.confirm({
      title: "删除会话？",
      message: `确定删除会话「${conversationTitle(conversation)}」吗？删除后无法恢复。`,
      confirmLabel: "删除",
    });
    if (!confirmed) return;
    try {
      ai.deleteConversation(conversation.id);
    } catch (error) {
      await overlay.alert({ title: "删除失败", message: errorMessage(error) });
    }
  };

  const openActions = async (
    conversation: AiConversationSummary,
    anchor: ContextMenuAnchor,
  ): Promise<void> => {
    const action = await overlay.menu({
      anchor,
      title: conversationTitle(conversation),
      options: [
        { key: "rename", label: "重命名" },
        {
          key: conversation.status === "archived" ? "unarchive" : "archive",
          label: conversation.status === "archived" ? "取消归档" : "归档",
        },
        { key: "delete", label: "删除", destructive: true },
      ],
    });

    if (action === "rename") {
      await handleRename(conversation);
      return;
    }
    if (action === "delete") {
      await handleDelete(conversation);
      return;
    }
    try {
      if (action === "archive") ai.archiveConversation(conversation.id);
      if (action === "unarchive") ai.unarchiveConversation(conversation.id);
    } catch (error) {
      await overlay.alert({ title: "操作失败", message: errorMessage(error) });
    }
  };

  return (
    <View style={aiStyles.historyPage}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        style={aiStyles.historySearchInput}
        placeholder="搜索标题或消息内容…"
        placeholderTextColor={color.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel="搜索会话"
      />
      <SectionList
        style={aiStyles.historyList}
        contentContainerStyle={
          itemCount === 0 ? aiStyles.historyListContentEmpty : aiStyles.historyListContent
        }
        sections={sections}
        keyExtractor={(item) => item.conversation.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) =>
          section.label ? <Text style={aiStyles.historyGroupLabel}>{section.label}</Text> : null
        }
        renderItem={({ item }) => (
          <AiChatHistoryRow
            item={item}
            active={item.conversation.id === ai.snapshot.conversationId}
            onSelect={() => {
              onSelectConversation(item.conversation.id);
            }}
            onOpenActions={(anchor) => {
              void openActions(item.conversation, anchor);
            }}
          />
        )}
        ListEmptyComponent={
          <Text style={aiStyles.empty}>
            {isSearching ? "无匹配会话" : includeArchived ? "暂无会话" : "暂无历史会话"}
          </Text>
        }
      />
      <View style={aiStyles.historyFooter}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: includeArchived }}
          onPress={() => {
            setIncludeArchived((current) => !current);
          }}
          style={aiStyles.historyArchiveToggle}
        >
          <View
            style={[
              aiStyles.historyCheckbox,
              includeArchived ? aiStyles.historyCheckboxChecked : null,
            ]}
          >
            {includeArchived ? <IconCheck width={14} height={14} color={color.background} /> : null}
          </View>
          <Text style={aiStyles.historyFooterLabel}>显示已归档</Text>
        </Pressable>
        <Text style={aiStyles.historyFooterCount}>{itemCount} 条</Text>
      </View>
    </View>
  );
}

type AiChatHistoryRowProps = {
  item: AiChatHistoryItem;
  active: boolean;
  onSelect: () => void;
  onOpenActions: (anchor: ContextMenuAnchor) => void;
};

function AiChatHistoryRow({ item, active, onSelect, onOpenActions }: AiChatHistoryRowProps) {
  const actionRef = useRef<ComponentRef<typeof Pressable>>(null);
  const { conversation, snippet } = item;
  const badges = conversationBadges(conversation);

  return (
    <View style={[aiStyles.historyRow, active ? aiStyles.historyRowActive : null]}>
      <Pressable
        style={aiStyles.historyRowMain}
        accessibilityRole="button"
        accessibilityLabel={conversationTitle(conversation)}
        accessibilityState={{ selected: active }}
        onPress={onSelect}
      >
        <View style={aiStyles.historyRowTitleLine}>
          <View style={aiStyles.historyActiveMark}>
            {active ? <IconCheck width={14} height={14} color={color.accent} /> : null}
          </View>
          <Text
            numberOfLines={1}
            style={[
              aiStyles.historyRowTitle,
              conversation.status === "archived" ? aiStyles.historyRowMuted : null,
            ]}
          >
            {conversationTitle(conversation)}
          </Text>
        </View>
        <View style={aiStyles.historyRowMetaLine}>
          {badges.map((badge) => (
            <Text key={badge} style={aiStyles.historyBadge}>
              {badge}
            </Text>
          ))}
          <Text style={aiStyles.historyRowDetail} numberOfLines={1}>
            {snippet || formatRelativeTime(conversation.updatedAt)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        ref={actionRef}
        collapsable={false}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`管理会话：${conversationTitle(conversation)}`}
        style={aiStyles.historyMoreButton}
        onPress={() => {
          actionRef.current?.measureInWindow((x, y, width, height) => {
            onOpenActions({ x, y, width, height });
          });
        }}
      >
        <IconEllipsis width={20} height={20} color={color.muted} />
      </Pressable>
    </View>
  );
}
