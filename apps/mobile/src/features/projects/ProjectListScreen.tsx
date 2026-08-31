import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "../../app/navigation-types";
import { pickNpkDocument } from "../../shared/files/mobile-file-bridge";
import { color, fontFamily, fontSize, radius, space, wash } from "../../shared/theme";
import { useOverlay } from "../../shared/ui/OverlayHost";
import { ProjectConflictError } from "./git/repository-manager";
import { useProjectManager } from "./ProjectManagerProvider";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ProjectListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const overlay = useOverlay();
  const manager = useProjectManager();
  const [busy, setBusy] = useState(false);

  const createProject = async () => {
    if (busy) return;
    const name = await overlay.prompt({
      title: "新建项目",
      placeholder: "项目名称",
      confirmLabel: "创建",
    });
    if (name === null) return;
    setBusy(true);
    try {
      const opened = await manager.createEmpty(name);
      navigation.navigate("Project", { projectId: opened.record.id });
    } catch (error) {
      await overlay.alert({ title: "创建失败", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const importProject = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await pickNpkDocument();
      if (picked === null) return;
      let opened;
      try {
        opened = await manager.importProject(picked.uri, picked.fileName);
      } catch (error) {
        if (!(error instanceof ProjectConflictError)) throw error;
        const confirmed = await overlay.confirm({
          title: "覆盖本地项目？",
          message: `“${error.existing.displayName}”的 Git 仓库和草稿将被替换。`,
          confirmLabel: "覆盖",
        });
        if (!confirmed) return;
        opened = await manager.importProject(picked.uri, picked.fileName, true);
      }
      navigation.navigate("Project", { projectId: opened.record.id });
    } catch (error) {
      await overlay.alert({ title: "导入失败", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>项目</Text>
          <Text style={styles.subtitle}>本地项目与离线草稿</Text>
        </View>
        <Pressable style={styles.settingsButton} onPress={() => navigation.navigate("Settings")}>
          <Text style={styles.settingsText}>设置</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            void createProject();
          }}
          disabled={busy}
        >
          <Text style={styles.primaryText}>新建项目</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void importProject();
          }}
          disabled={busy}
        >
          <Text style={styles.secondaryText}>{busy ? "处理中…" : "导入 .npk"}</Text>
        </Pressable>
      </View>
      <View style={styles.list}>
        {manager.records.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>还没有项目</Text>
            <Text style={styles.emptyText}>新建空白项目，或从桌面端导入 .npk 文件。</Text>
          </View>
        ) : (
          manager.records.map((record) => (
            <Pressable
              key={record.id}
              style={styles.row}
              onPress={() => navigation.navigate("Project", { projectId: record.id })}
            >
              <Text style={styles.rowTitle}>{record.displayName}</Text>
              <Text style={styles.rowMeta}>{new Date(record.lastOpenedAt).toLocaleString()}</Text>
            </Pressable>
          ))
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: color.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[3],
  },
  title: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xl,
    fontWeight: "600",
  },
  subtitle: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  settingsButton: {
    borderRadius: radius.control,
    backgroundColor: wash.iconButton,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  settingsText: {
    color: color.accent,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: space[2],
    paddingHorizontal: space[4],
    paddingBottom: space[3],
  },
  primaryButton: {
    borderRadius: radius.control,
    backgroundColor: color.accent,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  primaryText: {
    color: color.primaryForeground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  secondaryButton: {
    borderRadius: radius.control,
    backgroundColor: color.field,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  secondaryText: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  list: { flex: 1, paddingHorizontal: space[4] },
  row: { borderBottomWidth: 1, borderBottomColor: color.border, paddingVertical: space[3] },
  rowTitle: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  rowMeta: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.xs, marginTop: 2 },
  empty: { alignItems: "center", justifyContent: "center", flex: 1, gap: space[2] },
  emptyTitle: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  emptyText: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
});
