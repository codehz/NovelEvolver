import type { AiConversationSearchHit, AiConversationSummary } from "@novelevolver/domain/ai";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { color } from "../../../shared/theme";
import { aiStyles } from "./ai-chrome";
import { groupConversationsByActivity } from "./group-conversations";

type AiHistoryListProps = {
  conversations: readonly AiConversationSummary[];
  hits: readonly AiConversationSearchHit[] | null;
  activeId: string;
  query: string;
  includeArchived: boolean;
  onQueryChange: (value: string) => void;
  onToggleArchived: () => void;
  onSelect: (conversationId: string) => void;
  onRename: (conversation: AiConversationSummary) => void;
  onArchive: (conversation: AiConversationSummary) => void;
  onUnarchive: (conversation: AiConversationSummary) => void;
  onDelete: (conversation: AiConversationSummary) => void;
};

function activityLabel(activity: AiConversationSummary["activity"]): string {
  switch (activity) {
    case "streaming":
      return "生成中";
    case "awaiting_user":
      return "等待回复";
    default:
      return "";
  }
}

export function AiHistoryList({
  conversations,
  hits,
  activeId,
  query,
  includeArchived,
  onQueryChange,
  onToggleArchived,
  onSelect,
  onRename,
  onArchive,
  onUnarchive,
  onDelete,
}: AiHistoryListProps) {
  const visible = useMemo(() => {
    const source = hits ?? conversations;
    const filtered = includeArchived ? source : source.filter((item) => item.status !== "archived");
    if (hits) {
      return [{ id: "search", label: "搜索结果", items: filtered }];
    }
    return groupConversationsByActivity(filtered);
  }, [conversations, hits, includeArchived]);

  return (
    <>
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="搜索标题或消息内容…"
        placeholderTextColor={color.placeholder}
        style={aiStyles.searchInput}
      />
      <ScrollView style={aiStyles.pickerList} keyboardShouldPersistTaps="handled">
        {visible.length === 0 ? (
          <Text style={aiStyles.empty}>还没有会话。</Text>
        ) : (
          visible.map((group) => (
            <View key={group.id}>
              <Text style={aiStyles.groupLabel}>{group.label}</Text>
              {group.items.map((conversation) => {
                const snippet =
                  "snippet" in conversation ? (conversation.snippet as string | null) : null;
                const activity = activityLabel(conversation.activity);
                return (
                  <Pressable
                    key={conversation.id}
                    style={[
                      aiStyles.listRow,
                      conversation.id === activeId ? aiStyles.listRowActive : null,
                    ]}
                    onPress={() => {
                      onSelect(conversation.id);
                    }}
                  >
                    <Text style={aiStyles.listRowTitle} numberOfLines={1}>
                      {conversation.title || "新会话"}
                    </Text>
                    <Text style={aiStyles.listRowMeta}>
                      {[conversation.status === "archived" ? "已归档" : null, activity, snippet]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    <View style={aiStyles.rowActions}>
                      <Pressable
                        onPress={() => {
                          onRename(conversation);
                        }}
                      >
                        <Text style={aiStyles.actionLabel}>重命名</Text>
                      </Pressable>
                      {conversation.status === "archived" ? (
                        <Pressable
                          onPress={() => {
                            onUnarchive(conversation);
                          }}
                        >
                          <Text style={aiStyles.actionLabel}>取消归档</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => {
                            onArchive(conversation);
                          }}
                        >
                          <Text style={aiStyles.actionLabel}>归档</Text>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => {
                          onDelete(conversation);
                        }}
                      >
                        <Text style={aiStyles.dangerLabel}>删除</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
        <Pressable
          style={aiStyles.listRow}
          onPress={() => {
            onToggleArchived();
          }}
        >
          <Text style={aiStyles.actionLabel}>{includeArchived ? "隐藏已归档" : "显示已归档"}</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
