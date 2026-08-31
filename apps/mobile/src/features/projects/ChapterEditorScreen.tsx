import { Header } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize, space } from "../../shared/theme";
import { settingsStyles } from "../settings/settings-chrome";
import { SettingsHeaderBackButton } from "../settings/SettingsHeaderBackButton";
import { useProjectManager } from "./ProjectManagerProvider";

export function ChapterEditorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { projectId, nodeId } = route.params as RootStackParamList["Chapter"];
  const manager = useProjectManager();
  const opened = manager.opened?.record.id === projectId ? manager.opened : null;
  const node = opened?.worktree.outline.nodes[nodeId];
  const [content, setContent] = useState(() => opened?.worktree.readChapter(nodeId) ?? "");

  useEffect(() => {
    if (opened === null || node?.type !== "chapter") return;
    const timer = setTimeout(() => opened.worktree.flush(), 500);
    return () => clearTimeout(timer);
  }, [content, node?.type, opened]);

  useEffect(() => {
    if (opened === null) return;
    const onStateChange = (state: string) => {
      if (state === "background" || state === "inactive") opened.worktree.flush();
    };
    const subscription = AppState.addEventListener("change", onStateChange);
    return () => {
      opened.worktree.flush();
      subscription.remove();
    };
  }, [opened]);

  useEffect(() => {
    if (opened !== null) setContent(opened.worktree.readChapter(nodeId));
  }, [nodeId, opened]);

  if (opened === null || node?.type !== "chapter") {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.text}>章节不存在。</Text>
        </View>
      </SafeAreaView>
    );
  }

  const updateContent = (value: string) => {
    setContent(value);
    opened.worktree.writeChapter(nodeId, value);
  };

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <Header
        title={node.title}
        headerTintColor={color.accent}
        headerTitleStyle={styles.headerTitle}
        headerStyle={styles.header}
        headerShadowVisible={false}
        headerLeftContainerStyle={settingsStyles.headerLeftContainer}
        headerRightContainerStyle={styles.headerRightContainer}
        headerLeft={(props) => (
          <SettingsHeaderBackButton {...props} onPress={() => navigation.goBack()} />
        )}
        headerRight={() => (
          <Text style={styles.status}>
            {opened.worktree.hasChanges ? "有未提交修改" : "已提交"}
          </Text>
        )}
      />
      <TextInput
        multiline
        value={content}
        onChangeText={updateContent}
        placeholder="开始编辑章节正文…"
        placeholderTextColor={color.placeholder}
        textAlignVertical="top"
        style={styles.editor}
        selectionColor={color.accent}
        onBlur={() => {
          opened.worktree.flush();
        }}
      />
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
  headerRightContainer: {
    paddingEnd: space[4],
  },
  status: { color: color.warning, fontFamily: fontFamily.sans, fontSize: fontSize.xs },
  editor: {
    flex: 1,
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    lineHeight: 26,
    paddingHorizontal: space[4],
    paddingTop: space[4],
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
});
