import { Header } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize } from "../../shared/theme";
import { settingsStyles } from "../settings/settings-chrome";
import { SettingsHeaderBackButton } from "../settings/SettingsHeaderBackButton";
import { SettingsHeaderButton } from "../settings/SettingsHeaderButton";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { useProjectWorkspace } from "./use-project-workspace";

export function ProjectScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const projectId = (route.params as RootStackParamList["Project"]).projectId;
  const workspace = useProjectWorkspace(projectId);

  if (workspace === null) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.text}>正在打开项目…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { renameProject, exportProject, ...workspaceProps } = workspace;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <Header
        title={workspace.opened.record.displayName ?? "未命名项目"}
        headerTintColor={color.accent}
        headerTitleStyle={styles.headerTitle}
        headerStyle={styles.header}
        headerShadowVisible={false}
        headerLeftContainerStyle={settingsStyles.headerLeftContainer}
        headerLeft={(props) => (
          <SettingsHeaderBackButton {...props} onPress={() => navigation.goBack()} />
        )}
        headerRight={() => (
          <>
            <SettingsHeaderButton
              label="改名"
              onPress={() => {
                void renameProject();
              }}
            />
            <SettingsHeaderButton
              label="导出"
              onPress={() => {
                void exportProject();
              }}
            />
          </>
        )}
      />
      <ProjectWorkspace {...workspaceProps} />
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
  headerTitle: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
});
