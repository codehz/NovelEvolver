import { useNavigation, usePreventRemove, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import type { RootStackParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize } from "../../shared/theme";
import { type ProjectPage, shouldReturnToExplorer } from "./project-pager-model";
import { ProjectWorkspace, useProjectLayout } from "./ProjectWorkspace";
import { useProjectWorkspace } from "./use-project-workspace";

export function ProjectScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const projectId = (route.params as RootStackParamList["Project"]).projectId;
  const workspace = useProjectWorkspace(projectId);
  const layout = useProjectLayout();
  const insets = useSafeAreaInsets();
  const [activePage, setActivePage] = useState<ProjectPage>("Explorer");

  usePreventRemove(shouldReturnToExplorer(activePage, layout === "wide"), () => {
    setActivePage("Explorer");
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

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.keyboardAvoiding} behavior="padding">
        <ProjectWorkspace
          {...workspace}
          activePage={activePage}
          onActivePageChange={setActivePage}
          onBack={() => {
            navigation.goBack();
          }}
          topInset={insets.top}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: color.background },
  keyboardAvoiding: { flex: 1, minHeight: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
});
