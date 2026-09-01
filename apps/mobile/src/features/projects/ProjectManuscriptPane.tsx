import type { ManuscriptNode, ManuscriptOutline } from "@novelevolver/domain/worktree";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, fontFamily, fontSize, radius, space, wash } from "../../shared/theme";
import { ManuscriptTreeList } from "./manuscript/ManuscriptTreeList";

export type ProjectManuscriptPaneProps = {
  outline: ManuscriptOutline;
  selectedNodeId: string | null;
  warning: string | null;
  onOpenChapter: (nodeId: string) => void;
  onRename: (node: ManuscriptNode) => void;
  onDelete: (node: ManuscriptNode) => void;
  onMove: (sourceId: string, parentId: string, index?: number) => void;
  onCommit: () => void;
  onCreateFolder: () => void;
  onCreateChapter: () => Promise<boolean>;
  onDeleteProject: () => void;
};

export function ProjectManuscriptPane({
  outline,
  selectedNodeId,
  warning,
  onOpenChapter,
  onRename,
  onDelete,
  onMove,
  onCommit,
  onCreateFolder,
  onCreateChapter,
  onDeleteProject,
}: ProjectManuscriptPaneProps) {
  return (
    <View style={styles.root}>
      <View style={styles.paneHeader}>
        <Text style={styles.paneTitle}>正文</Text>
        <Text style={styles.paneHint}>目录</Text>
      </View>
      <View style={styles.toolbar}>
        <Pressable style={styles.primaryButton} onPress={onCommit}>
          <Text style={styles.primaryText}>提交</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onCreateFolder}>
          <Text style={styles.secondaryText}>文件夹</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onCreateChapter}>
          <Text style={styles.secondaryText}>章节</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={onDeleteProject}>
          <Text style={styles.dangerText}>删除</Text>
        </Pressable>
      </View>
      {warning !== null ? <Text style={styles.warning}>{warning}</Text> : null}
      <ManuscriptTreeList
        outline={outline}
        selectedNodeId={selectedNodeId}
        onOpenChapter={onOpenChapter}
        onRename={onRename}
        onDelete={onDelete}
        onMove={onMove}
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
  paneHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space[2],
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[2],
  },
  paneTitle: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  paneHint: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
    paddingHorizontal: space[3],
    paddingBottom: space[3],
  },
  primaryButton: {
    borderRadius: radius.control,
    backgroundColor: color.accent,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  primaryText: {
    color: color.primaryForeground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: radius.control,
    backgroundColor: color.field,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  secondaryText: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  dangerButton: {
    borderRadius: radius.control,
    backgroundColor: wash.dangerSoft,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  dangerText: {
    color: color.error,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  warning: {
    color: color.warning,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    paddingHorizontal: space[3],
    paddingBottom: space[2],
  },
});
