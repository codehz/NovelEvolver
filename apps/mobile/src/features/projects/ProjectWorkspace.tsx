import type { ManuscriptNode, ResourceTreeNode } from "@novelevolver/domain/worktree";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { TabActions } from "@react-navigation/native";
import { StyleSheet, View, useWindowDimensions } from "react-native";

import type { ProjectTabParamList } from "../../app/navigation-types";
import { color } from "../../shared/theme";
import { ProjectAiPane } from "./ai/ProjectAiPane";
import type { EditorDocument } from "./editor/editor-document";
import { ProjectEditorPane } from "./editor/ProjectEditorPane";
import { ProjectExplorerPane, type ProjectExplorerPaneProps } from "./explorer/ProjectExplorerPane";
import type { OpenedProject } from "./git/repository-manager";

export const PROJECT_MEDIUM_BREAKPOINT = 480;
export const PROJECT_WIDE_BREAKPOINT = 1024;
const PROJECT_MANUSCRIPT_WIDTH = 280;
const PROJECT_AI_WIDTH = 288;

export type ProjectLayout = "compact" | "medium" | "wide";

export function useProjectLayout(): ProjectLayout {
  const { width } = useWindowDimensions();
  if (width < PROJECT_MEDIUM_BREAKPOINT) return "compact";
  return width < PROJECT_WIDE_BREAKPOINT ? "medium" : "wide";
}

export type ProjectWorkspaceProps = Omit<
  ProjectExplorerPaneProps,
  "onOpenChapter" | "onOpenResourceFile" | "mediumHeader"
> & {
  opened: OpenedProject;
  document: EditorDocument | null;
  worktreeRevision: number;
  onOpenChapter: (nodeId: string) => void;
  onOpenResourceFile: (nodeId: string) => void;
  onAiWorkspaceDirty: () => void;
  onBack: () => void;
};

const ProjectTabs = createBottomTabNavigator<ProjectTabParamList>();

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

type ProjectTabsProps = Omit<ProjectWorkspaceProps, "onBack"> &
  EditorNodes & {
    layout: Exclude<ProjectLayout, "wide">;
    onBack: () => void;
  };

function ProjectTabsView({
  opened,
  document,
  chapter,
  resource,
  worktreeRevision,
  onOpenChapter,
  onOpenResourceFile,
  onAiWorkspaceDirty,
  layout,
  onBack,
  ...explorerProps
}: ProjectTabsProps) {
  return (
    <ProjectTabs.Navigator
      initialRouteName="Explorer"
      backBehavior="firstRoute"
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
        animation: "shift",
      }}
    >
      <ProjectTabs.Screen name="Explorer" options={{ title: "项目" }}>
        {({ navigation }) => (
          <ProjectExplorerPane
            {...explorerProps}
            mediumHeader={
              layout === "medium"
                ? {
                    activeTab: "Explorer",
                    onSelectTab: (tab) => {
                      navigation.dispatch(TabActions.jumpTo(tab));
                    },
                    onBack,
                  }
                : undefined
            }
            onCreateChapter={() =>
              explorerProps.onCreateChapter().then((created) => {
                if (created) navigation.navigate("Editor");
                return created;
              })
            }
            onCreateResourceFile={() =>
              explorerProps.onCreateResourceFile().then((created) => {
                if (created) navigation.navigate("Editor");
                return created;
              })
            }
            onOpenChapter={(nodeId) => {
              onOpenChapter(nodeId);
              navigation.navigate("Editor");
            }}
            onOpenResourceFile={(nodeId) => {
              onOpenResourceFile(nodeId);
              navigation.navigate("Editor");
            }}
          />
        )}
      </ProjectTabs.Screen>
      <ProjectTabs.Screen name="Editor" options={{ title: "编辑器" }}>
        {({ navigation }) => (
          <ProjectEditorPane
            opened={opened}
            document={document}
            chapter={chapter}
            resource={resource}
            worktreeRevision={worktreeRevision}
            onWorkspaceChanged={onAiWorkspaceDirty}
            mediumHeader={
              layout === "medium"
                ? {
                    activeTab: "Editor",
                    onSelectTab: (tab) => {
                      navigation.dispatch(TabActions.jumpTo(tab));
                    },
                    onBack,
                  }
                : undefined
            }
          />
        )}
      </ProjectTabs.Screen>
      <ProjectTabs.Screen name="AI" options={{ title: "AI" }}>
        {({ navigation }) => (
          <ProjectAiPane
            opened={opened}
            onWorkspaceDirty={onAiWorkspaceDirty}
            mediumHeader={
              layout === "medium"
                ? {
                    activeTab: "AI",
                    onSelectTab: (tab) => {
                      navigation.dispatch(TabActions.jumpTo(tab));
                    },
                    onBack,
                  }
                : undefined
            }
          />
        )}
      </ProjectTabs.Screen>
    </ProjectTabs.Navigator>
  );
}

type ProjectWorkspaceViewProps = ProjectWorkspaceProps & {
  topInset: number;
};

export function ProjectWorkspace({
  opened,
  document,
  worktreeRevision,
  onOpenChapter,
  onOpenResourceFile,
  onAiWorkspaceDirty,
  onBack,
  topInset,
  ...explorerProps
}: ProjectWorkspaceViewProps) {
  const layout = useProjectLayout();
  const { chapter, resource } = resolveEditorNodes(
    document,
    explorerProps.outline,
    explorerProps.resourceTree,
  );
  if (layout !== "wide") {
    return (
      <View style={styles.compact}>
        <ProjectTabsView
          opened={opened}
          document={document}
          chapter={chapter}
          resource={resource}
          worktreeRevision={worktreeRevision}
          onOpenChapter={onOpenChapter}
          onOpenResourceFile={onOpenResourceFile}
          onAiWorkspaceDirty={onAiWorkspaceDirty}
          layout={layout}
          onBack={onBack}
          {...explorerProps}
        />
      </View>
    );
  }

  const topInsetStyle = { paddingTop: topInset };

  return (
    <View style={styles.wide}>
      <View
        style={[styles.manuscriptColumn, styles.wideColumn, styles.columnBorder, topInsetStyle]}
      >
        <ProjectExplorerPane
          {...explorerProps}
          onOpenChapter={onOpenChapter}
          onOpenResourceFile={onOpenResourceFile}
          onBack={onBack}
        />
      </View>
      <View style={[styles.editorColumn, styles.wideColumn, topInsetStyle]}>
        <ProjectEditorPane
          opened={opened}
          document={document}
          chapter={chapter}
          resource={resource}
          worktreeRevision={worktreeRevision}
          onWorkspaceChanged={onAiWorkspaceDirty}
        />
      </View>
      <View style={[styles.aiColumn, styles.wideColumn, styles.columnBorderLeft, topInsetStyle]}>
        <ProjectAiPane opened={opened} onWorkspaceDirty={onAiWorkspaceDirty} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    flex: 1,
    minHeight: 0,
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
});
