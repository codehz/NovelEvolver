import type {
  ChangesSnapshot,
  ManuscriptNode,
  ManuscriptOutline,
  ResourceTreeNode,
  ResourceTreeSnapshot,
} from "@novelevolver/domain/worktree";
import { StyleSheet, Text, View } from "react-native";
import IconCheck from "~icons/codicon/check";
import IconDiscard from "~icons/codicon/discard";
import IconNewFile from "~icons/codicon/new-file";
import IconNewFolder from "~icons/codicon/new-folder";

import { color, fontFamily, fontSize, space } from "../../../shared/theme";
import { SettingsHeaderBackButton } from "../../settings/SettingsHeaderBackButton";
import { SettingsHeaderButton } from "../../settings/SettingsHeaderButton";
import { ProjectChangesPane } from "../changes/ProjectChangesPane";
import { ManuscriptTreeList } from "../manuscript/ManuscriptTreeList";
import { projectPaneStyles } from "../project-pane-chrome";
import { ResourceTreeList } from "../resource/ResourceTreeList";
import { ExplorerDomainSelect, type ExplorerDomain } from "./ExplorerDomainSelect";

export type ProjectExplorerPaneProps = {
  domain: ExplorerDomain;
  onDomainChange: (domain: ExplorerDomain) => void;
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
  changesSnapshot: ChangesSnapshot | null;
  changesLoading: boolean;
  changesError: boolean;
  onRetryChanges: () => void;
  onRevertChange: (changeId: string) => void;
  onRevertAllChanges: () => void;
  onCommitChanges: (message: string) => Promise<boolean>;
  commitMessage: string;
  onCommitMessageChange: (message: string) => void;
  onBack?: () => void;
  showHeader?: boolean;
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
  changesSnapshot,
  changesLoading,
  changesError,
  onRetryChanges,
  onRevertChange,
  onRevertAllChanges,
  onCommitChanges,
  commitMessage,
  onCommitMessageChange,
  onBack,
  showHeader = true,
}: ProjectExplorerPaneProps) {
  const manuscript = domain === "manuscript";
  const resource = domain === "resource";
  const canCommit = commitMessage.trim() !== "" && changesSnapshot?.hasChanges === true;
  const commit = async () => {
    if (!canCommit) return;
    if (await onCommitChanges(commitMessage)) onCommitMessageChange("");
  };
  const headerActions =
    domain === "changes" ? (
      <>
        <SettingsHeaderButton
          Icon={IconDiscard}
          label="全部还原"
          disabled={!changesSnapshot?.hasChanges}
          onPress={onRevertAllChanges}
        />
        <SettingsHeaderButton
          Icon={IconCheck}
          label="提交"
          disabled={!canCommit}
          onPress={() => {
            void commit();
          }}
        />
      </>
    ) : manuscript ? (
      <>
        <SettingsHeaderButton
          Icon={IconNewFile}
          label="新建章节"
          onPress={() => {
            void onCreateChapter();
          }}
        />
        <SettingsHeaderButton Icon={IconNewFolder} label="新建文件夹" onPress={onCreateFolder} />
      </>
    ) : resource ? (
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
    ) : null;
  return (
    <View style={styles.root}>
      {showHeader ? (
        <View style={[projectPaneStyles.header, styles.paneHeader]}>
          {onBack ? (
            <SettingsHeaderBackButton
              tintColor={color.accent}
              onPress={onBack}
              style={styles.paneBack}
            />
          ) : null}
          <ExplorerDomainSelect value={domain} onChange={onDomainChange} />
          <View style={styles.paneActions}>{headerActions}</View>
        </View>
      ) : null}
      {domain === "changes" ? (
        <ProjectChangesPane
          snapshot={changesSnapshot}
          loading={changesLoading}
          error={changesError}
          onRetry={onRetryChanges}
          onRevertChange={onRevertChange}
          commitMessage={commitMessage}
          onCommitMessageChange={onCommitMessageChange}
        />
      ) : (
        <>
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
        </>
      )}
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
  },
  paneBack: {
    width: 32,
    height: 32,
    marginEnd: 0,
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
});
