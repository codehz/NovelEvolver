import type {
  ManuscriptNode,
  ResourceTreeNode,
  WorktreeDomain,
} from "@novelevolver/domain/worktree";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { color, fontFamily, fontSize, space } from "../../shared/theme";
import type { OpenedProject } from "./git/repository-manager";

type ProjectEditorPaneProps = {
  opened: OpenedProject;
  domain: WorktreeDomain;
  chapter: ManuscriptNode | undefined;
  resource: ResourceTreeNode | undefined;
};

export function ProjectEditorPane({ opened, domain, chapter, resource }: ProjectEditorPaneProps) {
  const chapterId = chapter?.type === "chapter" ? chapter.id : null;
  const resourceId = resource?.type === "file" ? resource.id : null;
  const documentId = domain === "manuscript" ? chapterId : resourceId;
  const [content, setContent] = useState(() =>
    documentId === null
      ? ""
      : domain === "manuscript"
        ? opened.worktree.readChapter(documentId)
        : opened.worktree.readResourceFile(documentId),
  );

  useEffect(() => {
    if (documentId === null) {
      setContent("");
      return;
    }
    setContent(
      domain === "manuscript"
        ? opened.worktree.readChapter(documentId)
        : opened.worktree.readResourceFile(documentId),
    );
  }, [documentId, domain, opened]);

  if (domain === "manuscript" && (chapter?.type !== "chapter" || chapterId === null)) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholderTitle}>编辑器</Text>
        <Text style={styles.placeholderText}>请从正文中选择一个章节。</Text>
      </View>
    );
  }
  if (domain === "resource" && (resource?.type !== "file" || resourceId === null)) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholderTitle}>编辑器</Text>
        <Text style={styles.placeholderText}>请从资源库中选择一个文件。</Text>
      </View>
    );
  }
  if (documentId === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholderTitle}>编辑器</Text>
        <Text style={styles.placeholderText}>请选择要编辑的内容。</Text>
      </View>
    );
  }

  const title = domain === "manuscript" ? (chapter?.title ?? "") : (resource?.name ?? "");
  const subtitle = domain === "manuscript" ? "章节正文" : "资源文件";
  const placeholder = domain === "manuscript" ? "开始编辑章节正文…" : "开始编辑资源文件…";

  const updateContent = (value: string) => {
    setContent(value);
    if (domain === "manuscript") opened.worktree.writeChapter(documentId, value);
    else opened.worktree.writeResourceFile(documentId, value);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.status}>
          {opened.worktree.hasPendingChanges() ? "有未提交修改" : "已提交"}
        </Text>
      </View>
      <TextInput
        multiline
        value={content}
        onChangeText={updateContent}
        placeholder={placeholder}
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
