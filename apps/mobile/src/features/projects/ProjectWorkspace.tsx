import type { ManuscriptNode, ResourceTreeNode } from "@novelevolver/domain/worktree";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import IconCommentDiscussion from "~icons/codicon/comment-discussion";
import IconEdit from "~icons/codicon/edit";
import IconFiles from "~icons/codicon/files";

import type { ProjectTabParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize } from "../../shared/theme";
import type { EditorDocument } from "./editor/editor-document";
import { ProjectEditorPane } from "./editor/ProjectEditorPane";
import { ProjectExplorerPane, type ProjectExplorerPaneProps } from "./explorer/ProjectExplorerPane";
import type { OpenedProject } from "./git/repository-manager";
import { ProjectAiPlaceholderPane } from "./ProjectAiPlaceholderPane";

export const PROJECT_WIDE_BREAKPOINT = 1024;
const PROJECT_MANUSCRIPT_WIDTH = 256;
const PROJECT_AI_WIDTH = 288;

export function useProjectLayout(): "compact" | "wide" {
  const { width } = useWindowDimensions();
  return width < PROJECT_WIDE_BREAKPOINT ? "compact" : "wide";
}

export type ProjectWorkspaceProps = Omit<
  ProjectExplorerPaneProps,
  "onOpenChapter" | "onOpenResourceFile"
> & {
  opened: OpenedProject;
  document: EditorDocument | null;
  onOpenChapter: (nodeId: string) => void;
  onOpenResourceFile: (nodeId: string) => void;
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

type ProjectTabsProps = ProjectWorkspaceProps & EditorNodes;

function ProjectTabsView({
  opened,
  document,
  chapter,
  resource,
  onOpenChapter,
  onOpenResourceFile,
  ...explorerProps
}: ProjectTabsProps) {
  return (
    <ProjectTabs.Navigator
      initialRouteName="Explorer"
      backBehavior="firstRoute"
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.muted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontFamily: fontFamily.sans,
          fontSize: fontSize.xxs,
          fontWeight: "600",
        },
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
        },
      }}
    >
      <ProjectTabs.Screen
        name="Explorer"
        options={{
          title: "项目",
          tabBarIcon: ({ color: iconColor, size }) => (
            <IconFiles width={size} height={size} color={iconColor} />
          ),
        }}
      >
        {({ navigation }) => (
          <ProjectExplorerPane
            {...explorerProps}
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
      <ProjectTabs.Screen
        name="Editor"
        options={{
          title: "编辑器",
          tabBarIcon: ({ color: iconColor, size }) => (
            <IconEdit width={size} height={size} color={iconColor} />
          ),
        }}
      >
        {() => (
          <ProjectEditorPane
            opened={opened}
            document={document}
            chapter={chapter}
            resource={resource}
          />
        )}
      </ProjectTabs.Screen>
      <ProjectTabs.Screen
        name="AI"
        options={{
          title: "AI",
          tabBarIcon: ({ color: iconColor, size }) => (
            <IconCommentDiscussion width={size} height={size} color={iconColor} />
          ),
        }}
      >
        {ProjectAiPlaceholderPane}
      </ProjectTabs.Screen>
    </ProjectTabs.Navigator>
  );
}

export function ProjectWorkspace({
  opened,
  document,
  onOpenChapter,
  onOpenResourceFile,
  ...explorerProps
}: ProjectWorkspaceProps) {
  const layout = useProjectLayout();
  const { chapter, resource } = resolveEditorNodes(
    document,
    explorerProps.outline,
    explorerProps.resourceTree,
  );
  if (layout === "compact") {
    return (
      <View style={styles.compact}>
        <ProjectTabsView
          opened={opened}
          document={document}
          chapter={chapter}
          resource={resource}
          onOpenChapter={onOpenChapter}
          onOpenResourceFile={onOpenResourceFile}
          {...explorerProps}
        />
      </View>
    );
  }

  return (
    <View style={styles.wide}>
      <View style={[styles.manuscriptColumn, styles.columnBorder]}>
        <ProjectExplorerPane
          {...explorerProps}
          onOpenChapter={onOpenChapter}
          onOpenResourceFile={onOpenResourceFile}
        />
      </View>
      <View style={styles.editorColumn}>
        <ProjectEditorPane
          opened={opened}
          document={document}
          chapter={chapter}
          resource={resource}
        />
      </View>
      <View style={[styles.aiColumn, styles.columnBorderLeft]}>
        <ProjectAiPlaceholderPane />
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
