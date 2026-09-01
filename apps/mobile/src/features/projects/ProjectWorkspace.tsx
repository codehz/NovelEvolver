import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import IconCommentDiscussion from "~icons/codicon/comment-discussion";
import IconEdit from "~icons/codicon/edit";
import IconFiles from "~icons/codicon/files";

import type { ProjectTabParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize } from "../../shared/theme";
import { ChapterEditorPane } from "./ChapterEditorPane";
import type { OpenedProject } from "./git/repository-manager";
import { ProjectAiPlaceholderPane } from "./ProjectAiPlaceholderPane";
import { ProjectManuscriptPane, type ProjectManuscriptPaneProps } from "./ProjectManuscriptPane";

const PROJECT_WIDE_BREAKPOINT = 1024;
const PROJECT_MANUSCRIPT_WIDTH = 256;
const PROJECT_AI_WIDTH = 288;

export type ProjectWorkspaceProps = Omit<ProjectManuscriptPaneProps, "onOpenChapter"> & {
  opened: OpenedProject;
  selectedNodeId: string | null;
  onOpenChapter: (nodeId: string) => void;
};

const ProjectTabs = createBottomTabNavigator<ProjectTabParamList>();

type ProjectTabsProps = ProjectWorkspaceProps;

function ProjectTabsView({
  opened,
  selectedNodeId,
  onOpenChapter,
  ...manuscriptProps
}: ProjectTabsProps) {
  const selectedNode =
    selectedNodeId === null ? undefined : manuscriptProps.outline.nodes[selectedNodeId];
  return (
    <ProjectTabs.Navigator
      initialRouteName="Project"
      screenOptions={{
        headerShown: false,
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
          <ProjectManuscriptPane
            {...manuscriptProps}
            onCreateChapter={() =>
              manuscriptProps.onCreateChapter().then((created) => {
                if (created) navigation.navigate("Editor");
                return created;
              })
            }
            selectedNodeId={selectedNodeId}
            onOpenChapter={(nodeId) => {
              onOpenChapter(nodeId);
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
        {() => <ChapterEditorPane opened={opened} node={selectedNode} />}
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
  selectedNodeId,
  onOpenChapter,
  ...manuscriptProps
}: ProjectWorkspaceProps) {
  const { width } = useWindowDimensions();
  const selectedNode =
    selectedNodeId === null ? undefined : manuscriptProps.outline.nodes[selectedNodeId];
  const manuscriptPane = (
    <ProjectManuscriptPane
      {...manuscriptProps}
      selectedNodeId={selectedNodeId}
      onOpenChapter={onOpenChapter}
    />
  );
  if (width < PROJECT_WIDE_BREAKPOINT) {
    return (
      <View style={styles.compact}>
        <ProjectTabsView
          opened={opened}
          selectedNodeId={selectedNodeId}
          onOpenChapter={onOpenChapter}
          {...manuscriptProps}
        />
      </View>
    );
  }

  return (
    <View style={styles.wide}>
      <View style={[styles.manuscriptColumn, styles.columnBorder]}>{manuscriptPane}</View>
      <View style={styles.editorColumn}>
        <ChapterEditorPane opened={opened} node={selectedNode} />
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
