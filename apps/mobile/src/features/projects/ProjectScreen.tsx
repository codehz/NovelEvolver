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
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import type { ProjectTabParamList, RootStackParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize } from "../../shared/theme";
import { settingsStyles } from "../settings/settings-chrome";
import { SettingsHeaderBackButton } from "../settings/SettingsHeaderBackButton";
import { ProjectHeaderTabs } from "./ProjectHeaderTabs";
import { ProjectWorkspace, useProjectLayout } from "./ProjectWorkspace";
import { useProjectWorkspace } from "./use-project-workspace";

export function ProjectScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const projectId = (route.params as RootStackParamList["Project"]).projectId;
  const workspace = useProjectWorkspace(projectId);
  const layout = useProjectLayout();
  const insets = useSafeAreaInsets();
  const nestedTab = useNavigationState((state) => {
    const projectRoute = state.routes.find((item) => item.name === "Project");
    return projectRoute?.state?.type === "tab" ? projectRoute.state : undefined;
  });
  const currentTab = nestedTab?.routes[nestedTab.index ?? 0]?.name as
    | keyof ProjectTabParamList
    | undefined;
  usePreventRemove(layout !== "wide" && currentTab != null && currentTab !== "Explorer", () => {
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
  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.keyboardAvoiding} behavior="padding">
        {layout === "compact" ? (
          <Header
            title=""
            headerTitle={() => (
              <ProjectHeaderTabs activeTab={currentTab ?? "Explorer"} onSelectTab={selectTab} />
            )}
            headerTitleAlign="center"
            headerTitleContainerStyle={styles.headerTitle}
            headerTintColor={color.accent}
            headerStyle={settingsStyles.header}
            headerShadowVisible={false}
            headerLeftContainerStyle={settingsStyles.headerLeftContainer}
            headerLeft={(props) => <SettingsHeaderBackButton {...props} onPress={goBack} />}
          />
        ) : null}
        <ProjectWorkspace
          {...workspace}
          onBack={goBack}
          topInset={layout === "wide" ? insets.top : 0}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: color.background },
  keyboardAvoiding: { flex: 1, minHeight: 0 },
  headerTitle: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    maxWidth: "100%",
    marginHorizontal: 0,
    alignItems: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
});
