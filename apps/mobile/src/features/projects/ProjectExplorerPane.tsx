import type {
  ManuscriptNode,
  ManuscriptOutline,
  ResourceTreeNode,
  ResourceTreeSnapshot,
  WorktreeDomain,
} from "@novelevolver/domain/worktree";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import IconNewFile from "~icons/codicon/new-file";
import IconNewFolder from "~icons/codicon/new-folder";

import { color, fontFamily, fontSize, space } from "../../shared/theme";
import { SettingsHeaderButton } from "../settings/SettingsHeaderButton";
import { ExplorerDomainSelect } from "./explorer/ExplorerDomainSelect";
import { ManuscriptTreeList } from "./manuscript/ManuscriptTreeList";
import { ResourceTreeList } from "./resource/ResourceTreeList";

export type ProjectExplorerPaneProps = {
  domain: WorktreeDomain;
  onDomainChange: (domain: WorktreeDomain) => void;
  outline: ManuscriptOutline;
  resourceTree: ResourceTreeSnapshot;
  selectedManuscriptId: string | null;
  selectedResourceId: string | null;
  warning: string | null;
  onOpenChapter: (nodeId: string) => void;
  onOpenResourceFile: (nodeId: string) => void;
  onRenameManuscript: (node: ManuscriptNode) => void;
  onDeleteManuscript: (node: ManuscriptNode) => void;
  onMoveManuscript: (sourceId: string, parentId: string, index?: number) => void;
  onRenameResource: (node: ResourceTreeNode) => void;
  onDeleteResource: (node: ResourceTreeNode) => void;
  onMoveResource: (sourceId: string, parentId: string) => void;
  onCreateFolder: () => void;
  onCreateChapter: () => Promise<boolean>;
  onCreateResourceFolder: () => void;
  onCreateResourceFile: () => Promise<boolean>;
};

export function ProjectExplorerPane({
  domain,
  onDomainChange,
  outline,
  resourceTree,
  selectedManuscriptId,
  selectedResourceId,
  warning,
  onOpenChapter,
  onOpenResourceFile,
  onRenameManuscript,
  onDeleteManuscript,
  onMoveManuscript,
  onRenameResource,
  onDeleteResource,
  onMoveResource,
  onCreateFolder,
  onCreateChapter,
  onCreateResourceFolder,
  onCreateResourceFile,
}: ProjectExplorerPaneProps) {
  const [selectOpen, setSelectOpen] = useState(false);
  const manuscript = domain === "manuscript";
  return (
    <View style={styles.root}>
      <View style={styles.paneHeader}>
        <ExplorerDomainSelect
          value={domain}
          open={selectOpen}
          onOpenChange={setSelectOpen}
          onChange={onDomainChange}
        />
        <View style={styles.paneActions}>
          {manuscript ? (
            <>
              <SettingsHeaderButton
                Icon={IconNewFile}
                label="新建章节"
                onPress={() => {
                  void onCreateChapter();
                }}
              />
              <SettingsHeaderButton
                Icon={IconNewFolder}
                label="新建文件夹"
                onPress={onCreateFolder}
              />
            </>
          ) : (
            <>
              <SettingsHeaderButton
                Icon={IconNewFile}
                label="新建文件"
                onPress={() => {
                  void onCreateResourceFile();
                }}
              />
              <SettingsHeaderButton
                Icon={IconNewFolder}
                label="新建文件夹"
                onPress={onCreateResourceFolder}
              />
            </>
          )}
        </View>
      </View>
      {warning !== null ? <Text style={styles.warning}>{warning}</Text> : null}
      {manuscript ? (
        <ManuscriptTreeList
          outline={outline}
          selectedNodeId={selectedManuscriptId}
          onOpenChapter={onOpenChapter}
          onRename={onRenameManuscript}
          onDelete={onDeleteManuscript}
          onMove={onMoveManuscript}
        />
      ) : (
        <ResourceTreeList
          tree={resourceTree}
          selectedNodeId={selectedResourceId}
          onOpenFile={onOpenResourceFile}
          onRename={onRenameResource}
          onDelete={onDeleteResource}
          onMove={onMoveResource}
        />
      )}
      {selectOpen ? (
        <Pressable
          style={styles.dismiss}
          onPress={() => {
            setSelectOpen(false);
          }}
          accessibilityLabel="关闭选择"
        />
      ) : null}
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
    zIndex: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[2],
  },
  paneActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    marginLeft: "auto",
  },
  warning: {
    color: color.warning,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    paddingHorizontal: space[3],
    paddingBottom: space[2],
  },
  dismiss: {
    ...StyleSheet.absoluteFill,
    zIndex: 3,
  },
});
