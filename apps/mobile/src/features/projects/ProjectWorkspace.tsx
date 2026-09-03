import type { Change, ManuscriptNode, ResourceTreeNode } from "@novelevolver/domain/worktree";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import PagerView, {
  type PagerViewOnPageScrollEventData,
  type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import Animated, { useEvent, useSharedValue, type SharedValue } from "react-native-reanimated";
import IconAdd from "~icons/codicon/add";
import IconBeaker from "~icons/codicon/beaker";
import IconCheck from "~icons/codicon/check";
import IconDiscard from "~icons/codicon/discard";
import IconHistory from "~icons/codicon/history";
import IconNewFile from "~icons/codicon/new-file";
import IconNewFolder from "~icons/codicon/new-folder";

import { color, fontFamily, fontSize } from "../../shared/theme";
import { SettingsHeaderButton } from "../settings/SettingsHeaderButton";
import { aiStyles } from "./ai/ai-chrome";
import { ProjectAiPane, type AiPage, type ProjectAiPaneHandle } from "./ai/ProjectAiPane";
import { ProjectChangeComparisonPane } from "./changes/ProjectChangeComparisonPane";
import type { EditorDocument } from "./editor/editor-document";
import { ProjectEditorPane } from "./editor/ProjectEditorPane";
import { ExplorerDomainSelect } from "./explorer/ExplorerDomainSelect";
import { ProjectExplorerPane, type ProjectExplorerPaneProps } from "./explorer/ProjectExplorerPane";
import type { OpenedProject } from "./git/repository-manager";
import {
  PROJECT_PAGE_INDEX,
  preloadProjectPages,
  projectPageAt,
  type ProjectPage,
} from "./project-pager-model";
import {
  ProjectCompactHeader,
  ProjectMediumHeader,
  type ProjectHeaderContribution,
} from "./ProjectMediumHeader";
import type { ProjectComparisonTarget } from "./use-project-workspace";

export const PROJECT_MEDIUM_BREAKPOINT = 400;
export const PROJECT_WIDE_BREAKPOINT = 960;
const PROJECT_MANUSCRIPT_WIDTH = 280;
const PROJECT_AI_WIDTH = 320;

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export type ProjectLayout = "compact" | "medium" | "wide";

export function useProjectLayout(): ProjectLayout {
  const { width } = useWindowDimensions();
  if (width < PROJECT_MEDIUM_BREAKPOINT) return "compact";
  return width < PROJECT_WIDE_BREAKPOINT ? "medium" : "wide";
}

export type ProjectWorkspaceProps = Omit<
  ProjectExplorerPaneProps,
  | "onOpenChapter"
  | "onOpenResourceFile"
  | "commitMessage"
  | "onCommitMessageChange"
  | "worktree"
  | "historyRefreshKey"
  | "onBack"
  | "showHeader"
> & {
  opened: OpenedProject;
  document: EditorDocument | null;
  comparisonTarget: ProjectComparisonTarget | null;
  onOpenChange: (change: Change) => void;
  onCloseChange: () => void;
  worktreeRevision: number;
  onOpenChapter: (nodeId: string) => void;
  onOpenResourceFile: (nodeId: string) => void;
  onAiWorkspaceDirty: () => void;
};

type EditorNodes = {
  chapter: ManuscriptNode | undefined;
  resource: ResourceTreeNode | undefined;
};

function resolveEditorNodes(
  document: EditorDocument | null,
  outline: ProjectExplorerPaneProps["outline"],
  resourceTree: ProjectExplorerPaneProps["resourceTree"],
): EditorNodes {
  return {
    chapter: document?.domain === "manuscript" ? outline.nodes[document.id] : undefined,
    resource: document?.domain === "resource" ? resourceTree.nodes[document.id] : undefined,
  };
}

function usePageScrollHandler(progress: SharedValue<number>) {
  return useEvent<PagerViewOnPageScrollEventData>(
    (event) => {
      "worklet";
      progress.value = event.position + event.offset;
    },
    ["onPageScroll"],
  );
}

type ProjectWorkspaceViewProps = ProjectWorkspaceProps & {
  activePage: ProjectPage;
  onActivePageChange: (page: ProjectPage) => void;
  onBack: () => void;
  topInset: number;
};

export function ProjectWorkspace({
  opened,
  document,
  comparisonTarget,
  onOpenChange,
  onCloseChange,
  worktreeRevision,
  onOpenChapter,
  onOpenResourceFile,
  onAiWorkspaceDirty,
  activePage,
  onActivePageChange,
  onBack,
  topInset,
  ...explorerProps
}: ProjectWorkspaceViewProps) {
  const layout = useProjectLayout();
  const pagerRef = useRef<ComponentRef<typeof PagerView>>(null);
  const settledPageRef = useRef(activePage);
  const aiPaneRef = useRef<ProjectAiPaneHandle>(null);
  const scenarioTriggerRef = useRef<ComponentRef<typeof Pressable>>(null);
  const progress = useSharedValue(PROJECT_PAGE_INDEX[activePage]);
  const pageScrollHandler = usePageScrollHandler(progress);
  const [loadedPages, setLoadedPages] = useState<ReadonlySet<ProjectPage>>(() =>
    preloadProjectPages(activePage, new Set()),
  );
  const [commitMessage, setCommitMessage] = useState("");
  const [aiPage, setAiPage] = useState<AiPage>("chat");
  const { chapter, resource } = resolveEditorNodes(
    document,
    explorerProps.outline,
    explorerProps.resourceTree,
  );

  useEffect(() => {
    if (layout === "wide" || settledPageRef.current === activePage) return;
    setLoadedPages((current) => preloadProjectPages(activePage, current));
    const frame = requestAnimationFrame(() => {
      pagerRef.current?.setPage(PROJECT_PAGE_INDEX[activePage]);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [activePage, layout]);

  const selectPage = (page: ProjectPage) => {
    setLoadedPages((current) => preloadProjectPages(page, current));
    onActivePageChange(page);
  };

  const commit = async () => {
    const canCommit = commitMessage.trim() !== "" && explorerProps.changesSnapshot?.hasChanges;
    if (!canCommit) return;
    if (await explorerProps.onCommitChanges(commitMessage)) setCommitMessage("");
  };
  const manuscript = explorerProps.domain === "manuscript";
  const resourceDomain = explorerProps.domain === "resource";
  const canCommit =
    commitMessage.trim() !== "" && explorerProps.changesSnapshot?.hasChanges === true;
  const createChapterAndOpen = () =>
    explorerProps.onCreateChapter().then((created) => {
      if (created && layout !== "wide") selectPage("Editor");
      return created;
    });
  const createResourceFileAndOpen = () =>
    explorerProps.onCreateResourceFile().then((created) => {
      if (created && layout !== "wide") selectPage("Editor");
      return created;
    });
  const explorerActions =
    explorerProps.domain === "changes" ? (
      <>
        <SettingsHeaderButton
          Icon={IconDiscard}
          label="全部还原"
          disabled={!explorerProps.changesSnapshot?.hasChanges}
          onPress={explorerProps.onRevertAllChanges}
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
            void createChapterAndOpen();
          }}
        />
        <SettingsHeaderButton
          Icon={IconNewFolder}
          label="新建文件夹"
          onPress={explorerProps.onCreateFolder}
        />
      </>
    ) : resourceDomain ? (
      <>
        <SettingsHeaderButton
          Icon={IconNewFile}
          label="新建文件"
          onPress={() => {
            void createResourceFileAndOpen();
          }}
        />
        <SettingsHeaderButton
          Icon={IconNewFolder}
          label="新建文件夹"
          onPress={explorerProps.onCreateResourceFolder}
        />
      </>
    ) : null;

  const editorTitle =
    document?.domain === "manuscript"
      ? (chapter?.title ?? "编辑器")
      : document?.domain === "resource"
        ? (resource?.name ?? "编辑器")
        : "编辑器";
  const editorSubtitle =
    document?.domain === "manuscript"
      ? "章节正文"
      : document?.domain === "resource"
        ? "资源文件"
        : "未选择文档";

  const openScenarioMenu = () => {
    scenarioTriggerRef.current?.measureInWindow((x, y, width, height) => {
      aiPaneRef.current?.openScenarioMenu({ x, y, width, height });
    });
  };
  const aiActions = (
    <>
      {__DEV__ ? (
        <SettingsHeaderButton
          ref={scenarioTriggerRef}
          Icon={IconBeaker}
          label="测试场景"
          onPress={openScenarioMenu}
        />
      ) : null}
      <SettingsHeaderButton
        Icon={IconHistory}
        label={aiPage === "history" ? "显示当前会话" : "历史会话"}
        onPress={() => {
          aiPaneRef.current?.toggleHistory();
        }}
      />
      <SettingsHeaderButton
        Icon={IconAdd}
        label="新建会话"
        onPress={() => {
          aiPaneRef.current?.createConversation();
        }}
      />
    </>
  );

  const contributions: Record<ProjectPage, ProjectHeaderContribution> = {
    Explorer: {
      context: (
        <ExplorerDomainSelect
          value={explorerProps.domain}
          onChange={explorerProps.onDomainChange}
        />
      ),
      actions: explorerActions,
    },
    Editor: {
      context: (
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {editorTitle}
          </Text>
          <Text style={styles.subtitle}>{editorSubtitle}</Text>
        </View>
      ),
      actions: (
        <Text style={styles.status} numberOfLines={1}>
          {opened.worktree.hasPendingChanges() ? "有未提交修改" : "已提交"}
        </Text>
      ),
    },
    AI: {
      context: (
        <View style={aiStyles.headerTitleWrap}>
          <Text style={aiStyles.title}>AI</Text>
          <Text style={aiStyles.subtitle}>{aiPage === "history" ? "历史会话" : "助手"}</Text>
        </View>
      ),
      actions: aiActions,
    },
  };

  const explorerPane = (showHeader: boolean) => (
    <ProjectExplorerPane
      {...explorerProps}
      commitMessage={commitMessage}
      onCommitMessageChange={setCommitMessage}
      worktree={opened.worktree}
      historyRefreshKey={worktreeRevision}
      showHeader={showHeader}
      onOpenChapter={(nodeId) => {
        onOpenChapter(nodeId);
        if (!showHeader) selectPage("Editor");
      }}
      onOpenResourceFile={(nodeId) => {
        onOpenResourceFile(nodeId);
        if (!showHeader) selectPage("Editor");
      }}
      onOpenChange={(change) => {
        onOpenChange(change);
        if (!showHeader) selectPage("Editor");
      }}
      onOpenHistoryChange={(commitHash, change) => {
        explorerProps.onOpenHistoryChange(commitHash, change);
        if (!showHeader) selectPage("Editor");
      }}
      onCreateChapter={createChapterAndOpen}
      onCreateResourceFile={createResourceFileAndOpen}
      onBack={showHeader ? onBack : undefined}
    />
  );

  const editorPane = (showHeader: boolean) =>
    comparisonTarget !== null ? (
      <ProjectChangeComparisonPane
        worktree={opened.worktree}
        target={comparisonTarget}
        revision={worktreeRevision}
        onChanged={onAiWorkspaceDirty}
        onClose={onCloseChange}
        showHeader={showHeader}
      />
    ) : (
      <ProjectEditorPane
        opened={opened}
        document={document}
        chapter={chapter}
        resource={resource}
        worktreeRevision={worktreeRevision}
        onWorkspaceChanged={onAiWorkspaceDirty}
        showHeader={showHeader}
      />
    );

  const aiPane = (showHeader: boolean) => (
    <ProjectAiPane
      ref={aiPaneRef}
      opened={opened}
      onWorkspaceDirty={onAiWorkspaceDirty}
      page={aiPage}
      onPageChange={setAiPage}
      showHeader={showHeader}
    />
  );

  if (layout === "wide") {
    const topInsetStyle = { paddingTop: topInset };
    return (
      <View style={styles.wide}>
        <View
          style={[styles.manuscriptColumn, styles.wideColumn, styles.columnBorder, topInsetStyle]}
        >
          {explorerPane(true)}
        </View>
        <View style={[styles.editorColumn, styles.wideColumn, topInsetStyle]}>
          {editorPane(true)}
        </View>
        <View style={[styles.aiColumn, styles.wideColumn, styles.columnBorderLeft, topInsetStyle]}>
          {aiPane(true)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.compact}>
      {layout === "compact" ? (
        <ProjectCompactHeader
          activePage={activePage}
          progress={progress}
          onSelectPage={selectPage}
          onBack={onBack}
          contributions={contributions}
        />
      ) : (
        <ProjectMediumHeader
          activePage={activePage}
          progress={progress}
          onSelectPage={selectPage}
          onBack={onBack}
          contributions={contributions}
        />
      )}
      <AnimatedPagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={PROJECT_PAGE_INDEX[activePage]}
        keyboardDismissMode="on-drag"
        orientation="horizontal"
        overdrag={false}
        offscreenPageLimit={1}
        onPageScroll={pageScrollHandler}
        onPageSelected={(event: PagerViewOnPageSelectedEvent) => {
          const page = projectPageAt(event.nativeEvent.position);
          settledPageRef.current = page;
          progress.value = PROJECT_PAGE_INDEX[page];
          setLoadedPages((current) => preloadProjectPages(page, current));
          onActivePageChange(page);
        }}
      >
        <View key="Explorer" collapsable={false} style={styles.page}>
          {explorerPane(false)}
        </View>
        <View key="Editor" collapsable={false} style={styles.page}>
          {loadedPages.has("Editor") ? editorPane(false) : null}
        </View>
        <View key="AI" collapsable={false} style={styles.page}>
          {loadedPages.has("AI") ? aiPane(false) : null}
        </View>
      </AnimatedPagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    flex: 1,
    minHeight: 0,
    backgroundColor: color.background,
  },
  pager: {
    flex: 1,
  },
  page: {
    width: "100%",
    height: "100%",
    backgroundColor: color.background,
  },
  wide: {
    flex: 1,
    minHeight: 0,
    flexDirection: "row",
    backgroundColor: color.background,
  },
  wideColumn: {
    backgroundColor: color.surface,
  },
  manuscriptColumn: {
    width: PROJECT_MANUSCRIPT_WIDTH,
    flexShrink: 0,
  },
  editorColumn: {
    flex: 1,
    minWidth: 0,
  },
  aiColumn: {
    width: PROJECT_AI_WIDTH,
    flexShrink: 0,
  },
  columnBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: color.border,
  },
  columnBorderLeft: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: color.border,
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
});
