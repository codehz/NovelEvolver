import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import IconCommentDiscussion from "~icons/codicon/comment-discussion";
import IconEdit from "~icons/codicon/edit";
import IconFiles from "~icons/codicon/files";

import type { ProjectTabParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize } from "../../shared/theme";
import type { OpenedProject } from "./git/repository-manager";
import { ProjectAiPlaceholderPane } from "./ProjectAiPlaceholderPane";
import { ProjectEditorPane } from "./ProjectEditorPane";
import { ProjectExplorerPane, type ProjectExplorerPaneProps } from "./ProjectExplorerPane";

const PROJECT_WIDE_BREAKPOINT = 1024;
const PROJECT_MANUSCRIPT_WIDTH = 256;
const PROJECT_AI_WIDTH = 288;

export type ProjectWorkspaceProps = Omit<
  ProjectExplorerPaneProps,
  "onOpenChapter" | "onOpenResourceFile"
> & {
  opened: OpenedProject;
  onOpenChapter: (nodeId: string) => void;
  onOpenResourceFile: (nodeId: string) => void;
};

const ProjectTabs = createBottomTabNavigator<ProjectTabParamList>();

type ProjectTabsProps = ProjectWorkspaceProps;

function ProjectTabsView({
  opened,
  onOpenChapter,
  onOpenResourceFile,
  ...explorerProps
}: ProjectTabsProps) {
  const selectedChapter =
    explorerProps.selectedManuscriptId === null
      ? undefined
      : explorerProps.outline.nodes[explorerProps.selectedManuscriptId];
  const selectedResource =
    explorerProps.selectedResourceId === null
      ? undefined
      : explorerProps.resourceTree.nodes[explorerProps.selectedResourceId];
  return (
    <ProjectTabs.Navigator
      initialRouteName="Project"
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
        name="Project"
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
            domain={explorerProps.domain}
            chapter={selectedChapter}
            resource={selectedResource}
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
  onOpenChapter,
  onOpenResourceFile,
  ...explorerProps
}: ProjectWorkspaceProps) {
  const { width } = useWindowDimensions();
  const selectedChapter =
    explorerProps.selectedManuscriptId === null
      ? undefined
      : explorerProps.outline.nodes[explorerProps.selectedManuscriptId];
  const selectedResource =
    explorerProps.selectedResourceId === null
      ? undefined
      : explorerProps.resourceTree.nodes[explorerProps.selectedResourceId];
  const explorerPane = (
    <ProjectExplorerPane
      {...explorerProps}
      onOpenChapter={onOpenChapter}
      onOpenResourceFile={onOpenResourceFile}
    />
  );
  if (width < PROJECT_WIDE_BREAKPOINT) {
    return (
      <View style={styles.compact}>
        <ProjectTabsView
          opened={opened}
          onOpenChapter={onOpenChapter}
          onOpenResourceFile={onOpenResourceFile}
          {...explorerProps}
        />
      </View>
    );
  }

  return (
    <View style={styles.wide}>
      <View style={[styles.manuscriptColumn, styles.columnBorder]}>{explorerPane}</View>
      <View style={styles.editorColumn}>
        <ProjectEditorPane
          opened={opened}
          domain={explorerProps.domain}
          chapter={selectedChapter}
          resource={selectedResource}
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
