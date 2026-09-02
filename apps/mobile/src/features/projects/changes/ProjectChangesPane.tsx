import type { ChangesSnapshot, Change } from "@novelevolver/domain/worktree";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { color, fontFamily, fontSize, radius, space, wash } from "../../../shared/theme";
import { useOverlay } from "../../../shared/ui/OverlayHost";
import { ChangesList } from "./ChangesList";

type ProjectChangesPaneProps = {
  snapshot: ChangesSnapshot | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onRevertChange: (changeId: string) => void;
  onRevertAll: () => void;
  onCommit: (message: string) => Promise<boolean>;
};

export function ProjectChangesPane({
  snapshot,
  loading,
  error,
  onRetry,
  onRevertChange,
  onRevertAll,
  onCommit,
}: ProjectChangesPaneProps) {
  const overlay = useOverlay();
  const [message, setMessage] = useState("");
  const canCommit = message.trim() !== "" && snapshot?.hasChanges === true;
  const openChangePlaceholder = (_change: Change) => {
    void overlay.alert({
      title: "查看更改",
      message: "修改对比功能暂未支持，之后将加入此功能。",
      confirmLabel: "知道了",
    });
  };
  const handleCommit = async () => {
    if (!canCommit) return;
    const committed = await onCommit(message);
    if (committed) setMessage("");
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>更改</Text>
          <Text style={styles.subtitle}>当前工作区的未提交修改</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="还原所有更改"
          disabled={!snapshot?.hasChanges}
          onPress={onRevertAll}
          style={({ pressed }) => [
            styles.revertAll,
            !snapshot?.hasChanges && styles.disabled,
            pressed && snapshot?.hasChanges && styles.pressed,
          ]}
        >
          <Text style={styles.revertAllText}>全部还原</Text>
        </Pressable>
      </View>
      <View style={styles.commitBox}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          editable={snapshot?.hasChanges === true}
          placeholder="提交消息"
          placeholderTextColor={color.placeholder}
          style={styles.input}
          returnKeyType="done"
          onSubmitEditing={() => void handleCommit()}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="提交"
          disabled={!canCommit}
          onPress={() => void handleCommit()}
          style={({ pressed }) => [
            styles.commitButton,
            !canCommit && styles.disabled,
            pressed && canCommit && styles.pressed,
          ]}
        >
          <Text style={styles.commitText}>提交</Text>
        </Pressable>
      </View>
      {loading ? (
        <StatusView title="正在计算差异…" />
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
          <StatusView title="没有变更。" />
        </>
      ) : (
        <>
          {snapshot.warning ? <WarningBanner message={snapshot.warning} /> : null}
          <ChangesList
            manuscriptChanges={snapshot.manuscriptChanges}
            resourceChanges={snapshot.resourceChanges}
            onRevert={onRevertChange}
            onOpenChange={openChangePlaceholder}
          />
        </>
      )}
    </View>
  );
}

function StatusView({ title }: { title: string }) {
  return (
    <View style={styles.status}>
      <Text style={styles.statusIcon}>✓</Text>
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
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
    paddingHorizontal: space[4],
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
    fontSize: fontSize.xxs,
    marginTop: 2,
  },
  revertAll: {
    paddingHorizontal: space[2],
    paddingVertical: space[2],
    borderRadius: radius.control,
    backgroundColor: wash.dangerSoft,
  },
  revertAllText: { color: color.error, fontFamily: fontFamily.sans, fontSize: fontSize.xxs },
  commitBox: {
    flexDirection: "row",
    gap: space[2],
    padding: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  input: {
    flex: 1,
    minHeight: 38,
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
  commitButton: {
    justifyContent: "center",
    paddingHorizontal: space[4],
    borderRadius: radius.control,
    backgroundColor: color.accent,
  },
  commitText: {
    color: color.primaryForeground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
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
  statusIcon: { color: color.success, fontSize: 28 },
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
