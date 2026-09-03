import { Header } from "@react-navigation/elements";
import {
  TabActions,
  useNavigation,
  useNavigationState,
  usePreventRemove,
  useRoute,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import IconKebabVertical from "~icons/codicon/kebab-vertical";

import type { ProjectTabParamList, RootStackParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize, space } from "../../shared/theme";
import { useOverlay } from "../../shared/ui/OverlayHost";
import { settingsStyles } from "../settings/settings-chrome";
import { SettingsHeaderBackButton } from "../settings/SettingsHeaderBackButton";
import { SettingsHeaderButton } from "../settings/SettingsHeaderButton";
import { ProjectHeaderTabs } from "./ProjectHeaderTabs";
import { ProjectWorkspace, useProjectLayout } from "./ProjectWorkspace";
import { useProjectWorkspace } from "./use-project-workspace";

export function ProjectScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const overlay = useOverlay();
  const projectId = (route.params as RootStackParamList["Project"]).projectId;
  const workspace = useProjectWorkspace(projectId);
  const layout = useProjectLayout();
  const nestedTab = useNavigationState((state) => {
    const projectRoute = state.routes.find((item) => item.name === "Project");
    return projectRoute?.state?.type === "tab" ? projectRoute.state : undefined;
  });
  const currentTab = nestedTab?.routes[nestedTab.index ?? 0]?.name as
    | keyof ProjectTabParamList
    | undefined;
  usePreventRemove(layout === "compact" && currentTab != null && currentTab !== "Explorer", () => {
    if (nestedTab?.key == null) {
      return;
    }
    navigation.dispatch({
      ...TabActions.jumpTo("Explorer"),
      target: nestedTab.key,
    });
  });

  if (workspace === null) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.text}>正在打开项目…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { renameProject, shareProject, ...workspaceProps } = workspace;
  const goBack = () => {
    navigation.goBack();
  };
  const selectTab = (tab: keyof ProjectTabParamList) => {
    if (nestedTab?.key == null) {
      return;
    }
    navigation.dispatch({
      ...TabActions.jumpTo(tab),
      target: nestedTab.key,
    });
  };
  const showProjectMenu = () => {
    void overlay
      .menu({
        title: workspace.opened.record.displayName?.trim() || "未命名项目",
        options: [
          { key: "rename", label: "改名" },
          { key: "share", label: "分享" },
        ],
      })
      .then((action) => {
        if (action === "rename") {
          return renameProject();
        }
        if (action === "share") {
          return shareProject();
        }
      });
  };

  return (
    <SafeAreaView
      edges={layout === "compact" ? ["bottom"] : ["top", "bottom"]}
      style={styles.safeArea}
    >
      {layout === "compact" ? (
        <Header
          title=""
          headerTitle={() => (
            <ProjectHeaderTabs activeTab={currentTab ?? "Explorer"} onSelectTab={selectTab} />
          )}
          headerTintColor={color.accent}
          headerStyle={styles.header}
          headerShadowVisible={false}
          headerLeftContainerStyle={settingsStyles.headerLeftContainer}
          headerLeft={(props) => <SettingsHeaderBackButton {...props} onPress={goBack} />}
          headerRightContainerStyle={styles.headerRight}
          headerRight={() => (
            <SettingsHeaderButton
              Icon={IconKebabVertical}
              label="项目菜单"
              onPress={showProjectMenu}
            />
          )}
        />
      ) : null}
      <ProjectWorkspace {...workspaceProps} onBack={goBack} onProjectMenu={showProjectMenu} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: color.background },
  header: {
    backgroundColor: color.background,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  headerRight: {
    paddingEnd: space[4],
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
});
