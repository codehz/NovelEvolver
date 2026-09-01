import { StyleSheet, Text, View } from "react-native";
import IconCommentDiscussion from "~icons/codicon/comment-discussion";

import { color, fontFamily, fontSize, space } from "../../shared/theme";

export function ProjectAiPlaceholderPane() {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>AI</Text>
        <Text style={styles.subtitle}>助手</Text>
      </View>
      <View style={styles.center}>
        <IconCommentDiscussion width={32} height={32} color={color.accent} />
        <Text style={styles.placeholderTitle}>AI 功能即将推出</Text>
        <Text style={styles.placeholderText}>后续将在这里提供项目和章节相关的 AI 功能。</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0,
    backgroundColor: color.background,
  },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "baseline",
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
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
    fontSize: fontSize.xs,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    padding: space[6],
  },
  placeholderTitle: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  placeholderText: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
