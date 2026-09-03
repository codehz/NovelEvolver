import type {
  ChangesSnapshot,
  Change,
  ManuscriptNode,
  ManuscriptOutline,
  ResourceTreeNode,
  ResourceTreeSnapshot,
} from "@novelevolver/domain/worktree";
import type { WorktreeSession } from "@novelevolver/worktree";
import { useEffect, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import IconCheck from "~icons/codicon/check";
import IconDiscard from "~icons/codicon/discard";
import IconNewFile from "~icons/codicon/new-file";
import IconNewFolder from "~icons/codicon/new-folder";

import { color, fontFamily, fontSize, space } from "../../../shared/theme";
import { OVERLAY_TIMING } from "../../../shared/ui/overlay-chrome";
import { SettingsHeaderBackButton } from "../../settings/SettingsHeaderBackButton";
import { SettingsHeaderButton } from "../../settings/SettingsHeaderButton";
import { ProjectChangesPane } from "../changes/ProjectChangesPane";
import { ProjectHistoryPane } from "../history/ProjectHistoryPane";
import { ManuscriptTreeList } from "../manuscript/ManuscriptTreeList";
import { projectPaneStyles } from "../project-pane-chrome";
import { ResourceTreeList } from "../resource/ResourceTreeList";
import { ExplorerDomainSelect, type ExplorerDomain } from "./ExplorerDomainSelect";

const EXPLORER_DOMAIN_INDEX: Record<ExplorerDomain, number> = {
  manuscript: 0,
  resource: 1,
  changes: 2,
  history: 3,
};

type ExplorerDomainLayerProps = {
  active: boolean;
  index: number;
  previousIndex: SharedValue<number>;
  targetIndex: SharedValue<number>;
  transition: SharedValue<number>;
  children: ReactNode;
};

function ExplorerDomainLayer({
  active,
  index,
  previousIndex,
  targetIndex,
  transition,
  children,
}: ExplorerDomainLayerProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const previous = previousIndex.value;
    const target = targetIndex.value;
    if (previous === target) {
      return {
        display: index === target ? ("flex" as const) : ("none" as const),
        opacity: index === target ? 1 : 0,
        transform: [{ translateX: 0 }],
        zIndex: index === target ? 1 : 0,
      };
    }

    const direction = Math.sign(target - previous);
    if (index === target) {
      return {
        display: "flex" as const,
        opacity: transition.value,
        transform: [{ translateX: direction * 24 * (1 - transition.value) }],
        zIndex: 1,
      };
    }
    if (index === previous) {
      return {
        display: transition.value < 1 ? ("flex" as const) : ("none" as const),
        opacity: 1 - transition.value,
        transform: [{ translateX: -direction * 24 * transition.value }],
        zIndex: 0,
      };
    }
    return {
      display: "none" as const,
      opacity: 0,
      transform: [{ translateX: 0 }],
      zIndex: 0,
    };
  });

  return (
    <Animated.View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      pointerEvents={active ? "auto" : "none"}
      style={[styles.domainLayer, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

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
  onOpenChange: (change: Change) => void;
  onRevertAllChanges: () => void;
  onCommitChanges: (message: string) => Promise<boolean>;
  commitMessage: string;
  onCommitMessageChange: (message: string) => void;
  worktree: WorktreeSession;
  historyRefreshKey: number;
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
  onOpenChange,
  onRevertAllChanges,
  onCommitChanges,
  commitMessage,
  onCommitMessageChange,
  worktree,
  historyRefreshKey,
  onBack,
  showHeader = true,
}: ProjectExplorerPaneProps) {
  const manuscript = domain === "manuscript";
  const resource = domain === "resource";
  const reduceMotion = useReducedMotion();
  const initialDomainIndex = EXPLORER_DOMAIN_INDEX[domain];
  const previousDomainIndex = useSharedValue(initialDomainIndex);
  const targetDomainIndex = useSharedValue(initialDomainIndex);
  const domainTransition = useSharedValue(1);

  useEffect(() => {
    const nextIndex = EXPLORER_DOMAIN_INDEX[domain];
    if (targetDomainIndex.value === nextIndex) {
      if (reduceMotion) domainTransition.value = 1;
      return;
    }
    previousDomainIndex.value = targetDomainIndex.value;
    targetDomainIndex.value = nextIndex;
    domainTransition.value = 0;
    domainTransition.value = reduceMotion ? 1 : withTiming(1, OVERLAY_TIMING);
  }, [domain, domainTransition, previousDomainIndex, reduceMotion, targetDomainIndex]);

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
      <View style={styles.domainHost}>
        <ExplorerDomainLayer
          active={domain === "manuscript"}
          index={EXPLORER_DOMAIN_INDEX.manuscript}
          previousIndex={previousDomainIndex}
          targetIndex={targetDomainIndex}
          transition={domainTransition}
        >
          {warning !== null ? <Text style={styles.warning}>{warning}</Text> : null}
          <ManuscriptTreeList
            outline={outline}
            selectedNodeId={selectedManuscriptId}
            onOpenChapter={onOpenChapter}
            onRename={onRenameManuscript}
            onDelete={onDeleteManuscript}
            onMove={onMoveManuscript}
          />
        </ExplorerDomainLayer>
        <ExplorerDomainLayer
          active={domain === "resource"}
          index={EXPLORER_DOMAIN_INDEX.resource}
          previousIndex={previousDomainIndex}
          targetIndex={targetDomainIndex}
          transition={domainTransition}
        >
          {warning !== null ? <Text style={styles.warning}>{warning}</Text> : null}
          <ResourceTreeList
            tree={resourceTree}
            selectedNodeId={selectedResourceId}
            onOpenFile={onOpenResourceFile}
            onRename={onRenameResource}
            onDelete={onDeleteResource}
            onMove={onMoveResource}
          />
        </ExplorerDomainLayer>
        <ExplorerDomainLayer
          active={domain === "changes"}
          index={EXPLORER_DOMAIN_INDEX.changes}
          previousIndex={previousDomainIndex}
          targetIndex={targetDomainIndex}
          transition={domainTransition}
        >
          <ProjectChangesPane
            snapshot={changesSnapshot}
            loading={changesLoading}
            error={changesError}
            onRetry={onRetryChanges}
            onRevertChange={onRevertChange}
            onOpenChange={onOpenChange}
            commitMessage={commitMessage}
            onCommitMessageChange={onCommitMessageChange}
          />
        </ExplorerDomainLayer>
        <ExplorerDomainLayer
          active={domain === "history"}
          index={EXPLORER_DOMAIN_INDEX.history}
          previousIndex={previousDomainIndex}
          targetIndex={targetDomainIndex}
          transition={domainTransition}
        >
          <ProjectHistoryPane worktree={worktree} refreshKey={historyRefreshKey} />
        </ExplorerDomainLayer>
      </View>
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
  domainHost: {
    position: "relative",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  domainLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: color.background,
  },
  warning: {
    color: color.warning,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    paddingHorizontal: space[3],
    paddingBottom: space[2],
  },
});
