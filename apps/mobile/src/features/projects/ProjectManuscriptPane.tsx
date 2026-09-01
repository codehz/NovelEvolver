import type { ManuscriptNode, ManuscriptOutline } from "@novelevolver/domain/worktree";
import { StyleSheet, Text, View } from "react-native";
import IconNewFile from "~icons/codicon/new-file";
import IconNewFolder from "~icons/codicon/new-folder";

import { color, fontFamily, fontSize, space } from "../../shared/theme";
import { SettingsHeaderButton } from "../settings/SettingsHeaderButton";
import { ManuscriptTreeList } from "./manuscript/ManuscriptTreeList";

export type ProjectManuscriptPaneProps = {
  outline: ManuscriptOutline;
  selectedNodeId: string | null;
  warning: string | null;
  onOpenChapter: (nodeId: string) => void;
  onRename: (node: ManuscriptNode) => void;
  onDelete: (node: ManuscriptNode) => void;
  onMove: (sourceId: string, parentId: string, index?: number) => void;
  onCreateFolder: () => void;
  onCreateChapter: () => Promise<boolean>;
};

export function ProjectManuscriptPane({
  outline,
  selectedNodeId,
  warning,
  onOpenChapter,
  onRename,
  onDelete,
  onMove,
  onCreateFolder,
  onCreateChapter,
}: ProjectManuscriptPaneProps) {
  return (
    <View style={styles.root}>
      <View style={styles.paneHeader}>
        <View style={styles.paneTitleGroup}>
          <Text style={styles.paneTitle}>正文</Text>
          <Text style={styles.paneHint}>目录</Text>
        </View>
        <View style={styles.paneActions}>
          <SettingsHeaderButton
            Icon={IconNewFile}
            label="新建章节"
            onPress={() => {
              void onCreateChapter();
            }}
          />
          <SettingsHeaderButton Icon={IconNewFolder} label="新建文件夹" onPress={onCreateFolder} />
        </View>
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
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[2],
  },
  paneTitleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "baseline",
    gap: space[2],
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
  paneActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  warning: {
    color: color.warning,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    paddingHorizontal: space[3],
    paddingBottom: space[2],
  },
});
