import type { ChangesSnapshot, Change } from "@novelevolver/domain/worktree";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import IconCheck from "~icons/codicon/check";
import IconLoading from "~icons/codicon/loading";

import { color, fontFamily, fontSize, radius, space, wash } from "../../../shared/theme";
import { ChangesList } from "./ChangesList";

type ProjectChangesPaneProps = {
  snapshot: ChangesSnapshot | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onRevertChange: (changeId: string) => void;
  onOpenChange: (change: Change) => void;
  commitMessage: string;
  onCommitMessageChange: (message: string) => void;
};

export function ProjectChangesPane({
  snapshot,
  loading,
  error,
  onRetry,
  onRevertChange,
  onOpenChange,
  commitMessage,
  onCommitMessageChange,
}: ProjectChangesPaneProps) {
  return (
    <View style={styles.root}>
      <View style={styles.commitBox}>
        <TextInput
          value={commitMessage}
          onChangeText={onCommitMessageChange}
          editable={snapshot?.hasChanges === true}
          placeholder="提交消息"
          placeholderTextColor={color.placeholder}
          style={styles.input}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
      {loading ? (
        <StatusView title="正在计算差异…" icon="loading" />
      ) : error ? (
        <View style={styles.status}>
          <Text style={styles.statusTitle}>无法加载更改</Text>
          <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : snapshot === null || !snapshot.hasChanges ? (
        <>
          {snapshot?.warning ? <WarningBanner message={snapshot.warning} /> : null}
          <StatusView title="没有变更。" icon="check" />
        </>
      ) : (
        <>
          {snapshot.warning ? <WarningBanner message={snapshot.warning} /> : null}
          <ChangesList
            manuscriptChanges={snapshot.manuscriptChanges}
            resourceChanges={snapshot.resourceChanges}
            onRevert={onRevertChange}
            onOpenChange={onOpenChange}
          />
        </>
      )}
    </View>
  );
}

function StatusView({ title, icon }: { title: string; icon: "check" | "loading" }) {
  return (
    <View style={styles.status}>
      {icon === "check" ? (
        <IconCheck width={32} height={32} color={color.success} />
      ) : (
        <IconLoading width={32} height={32} color={color.accent} />
      )}
      <Text style={styles.statusTitle}>{title}</Text>
    </View>
  );
}

function WarningBanner({ message }: { message: string }) {
  return (
    <View style={styles.warning}>
      <Text style={styles.warningText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, backgroundColor: color.background },
  commitBox: {
    padding: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  input: {
    minHeight: 84,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.control,
    backgroundColor: color.field,
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  status: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    padding: space[4],
  },
  statusTitle: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  retry: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.control,
    backgroundColor: wash.accentSoft,
  },
  retryText: { color: color.accent, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
  warning: {
    margin: space[3],
    padding: space[3],
    borderWidth: 1,
    borderColor: color.warning,
    borderRadius: radius.control,
    backgroundColor: wash.mutedFill,
  },
  warningText: { color: color.warning, fontFamily: fontFamily.sans, fontSize: fontSize.xxs },
});
