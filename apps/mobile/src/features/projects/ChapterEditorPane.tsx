import type { ManuscriptNode } from "@novelevolver/domain/worktree";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { color, fontFamily, fontSize, space } from "../../shared/theme";
import type { OpenedProject } from "./git/repository-manager";

type ChapterEditorPaneProps = {
  opened: OpenedProject;
  node: ManuscriptNode | undefined;
};

export function ChapterEditorPane({ opened, node }: ChapterEditorPaneProps) {
  const nodeId = node?.type === "chapter" ? node.id : null;
  const [content, setContent] = useState(() =>
    nodeId === null ? "" : opened.worktree.readChapter(nodeId),
  );

  useEffect(() => {
    setContent(nodeId === null ? "" : opened.worktree.readChapter(nodeId));
  }, [nodeId, opened]);

  if (node?.type !== "chapter" || nodeId === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholderTitle}>编辑器</Text>
        <Text style={styles.placeholderText}>请从正文中选择一个章节。</Text>
      </View>
    );
  }

  const updateContent = (value: string) => {
    setContent(value);
    opened.worktree.writeChapter(nodeId, value);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {node.title}
          </Text>
          <Text style={styles.subtitle}>章节正文</Text>
        </View>
        <Text style={styles.status}>
          {opened.worktree.hasPendingChanges() ? "有未提交修改" : "已提交"}
        </Text>
      </View>
      <TextInput
        multiline
        value={content}
        onChangeText={updateContent}
        placeholder="开始编辑章节正文…"
        placeholderTextColor={color.placeholder}
        textAlignVertical="top"
        style={styles.editor}
        selectionColor={color.accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0,
    backgroundColor: color.background,
  },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
    paddingHorizontal: space[4],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  subtitle: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xxs,
    marginTop: 2,
  },
  status: {
    color: color.warning,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
  },
  editor: {
    flex: 1,
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    lineHeight: 26,
    paddingHorizontal: space[4],
    paddingTop: space[4],
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    padding: space[4],
    backgroundColor: color.background,
  },
  placeholderTitle: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  placeholderText: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
});
