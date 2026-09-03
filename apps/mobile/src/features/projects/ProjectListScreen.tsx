import type { ProjectDbRecord } from "@novelevolver/worktree";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useRef, useState, type ComponentRef } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import IconRepo from "~icons/codicon/repo";

import type { RootStackParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize, radius, space, wash } from "../../shared/theme";
import type { ContextMenuAnchor } from "../../shared/ui/context-menu-position";
import { useOverlay } from "../../shared/ui/OverlayHost";
import { errorMessage } from "./error-message";
import { useProjectManager } from "./ProjectManagerProvider";

const CARD_MIN_WIDTH = 224;
const CARD_GAP = space[3];
const LIST_HORIZONTAL_PADDING = space[4];

const IMPORT_HELP =
  "本应用通过系统文件管理器暴露项目目录。把桌面端的 .npk 复制到「NovelEvolver」即可出现在列表中；也可以从该目录把文件拷出或分享。";

export function ProjectListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const overlay = useOverlay();
  const manager = useProjectManager();
  const [busy, setBusy] = useState(false);

  const { width } = useWindowDimensions();
  const availableListWidth = Math.max(0, width - LIST_HORIZONTAL_PADDING * 2);
  const columnCount = Math.max(
    1,
    Math.floor((availableListWidth + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP)),
  );
  const cardWidth = (availableListWidth - CARD_GAP * Math.max(0, columnCount - 1)) / columnCount;

  const { refresh } = manager;
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

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
      manager.refresh();
      await overlay.alert({ title: "创建失败", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const importProject = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const fileName = await manager.importProject();
      if (fileName !== null) {
        await overlay.alert({ title: "导入完成", message: `${fileName} 已复制到工作区。` });
      }
    } catch (error) {
      manager.refresh();
      await overlay.alert({ title: "导入失败", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const showImportHelp = () => {
    void overlay.alert({ title: "如何加入项目", message: IMPORT_HELP });
  };

  const showProjectMenu = async (project: ProjectDbRecord, anchor: ContextMenuAnchor) => {
    if (busy) return;
    const name = project.displayName?.trim() || "未命名项目";
    const action = await overlay.menu({
      anchor,
      title: name,
      options: [
        { key: "rename", label: "改名" },
        { key: "share", label: "分享" },
        { key: "delete", label: "删除", destructive: true },
      ],
    });

    if (action === "rename") {
      const nextName = await overlay.prompt({
        title: "项目改名",
        placeholder: "项目名称",
        initialValue: name,
        confirmLabel: "保存",
      });
      if (nextName === null) return;
      setBusy(true);
      try {
        manager.renameProject(project.id, nextName);
      } catch (error) {
        manager.refresh();
        await overlay.alert({ title: "改名失败", message: errorMessage(error) });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (action === "share") {
      try {
        manager.shareProject(project.id);
      } catch (error) {
        await overlay.alert({ title: "分享失败", message: errorMessage(error) });
      }
      return;
    }

    if (action === "delete") {
      const confirmed = await overlay.confirm({
        title: `删除“${name}”？`,
        message: "项目文件及其全部内容将被永久删除，此操作无法撤销。",
        confirmLabel: "删除",
      });
      if (!confirmed) return;
      setBusy(true);
      try {
        await manager.deleteProject(project.id);
      } catch (error) {
        manager.refresh();
        await overlay.alert({ title: "删除失败", message: errorMessage(error) });
      } finally {
        setBusy(false);
      }
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
        {Platform.OS === "android" ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              void importProject();
            }}
            disabled={busy}
          >
            <Text style={styles.secondaryText}>导入项目</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.secondaryButton} onPress={showImportHelp} disabled={busy}>
            <Text style={styles.secondaryText}>如何加入</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        key={columnCount}
        data={manager.records}
        numColumns={columnCount}
        keyExtractor={(record) => String(record.id)}
        contentContainerStyle={[
          styles.listContent,
          manager.records.length === 0 && styles.emptyListContent,
        ]}
        columnWrapperStyle={columnCount > 1 ? styles.cardRow : undefined}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>还没有项目</Text>
            <Text style={styles.emptyText}>
              {Platform.OS === "android"
                ? "新建空白项目，或选择一个 .npk 文件并复制到工作区。"
                : "新建空白项目，或按照说明加入已有的 .npk 项目。"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            width={cardWidth}
            disabled={busy}
            onOpen={() => navigation.navigate("Project", { projectId: item.id })}
            onLongPress={(anchor) => {
              void showProjectMenu(item, anchor);
            }}
          />
        )}
      />
    </SafeAreaView>
  );
}

type ProjectCardProps = {
  project: ProjectDbRecord;
  width: number;
  disabled: boolean;
  onOpen: () => void;
  onLongPress: (anchor: ContextMenuAnchor) => void;
};

function ProjectCard({ project, width, disabled, onOpen, onLongPress }: ProjectCardProps) {
  const cardRef = useRef<ComponentRef<typeof Pressable>>(null);
  const name = project.displayName?.trim() || "未命名项目";

  return (
    <Pressable
      ref={cardRef}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={`打开项目：${name}`}
      accessibilityHint="长按可改名、分享或删除"
      disabled={disabled}
      onPress={onOpen}
      onLongPress={() => {
        cardRef.current?.measureInWindow((x, y, measuredWidth, height) => {
          onLongPress({ x, y, width: measuredWidth, height });
        });
      }}
      style={({ pressed }) => [styles.card, { width }, pressed && styles.cardPressed]}
    >
      <IconRepo width={22} height={22} color={color.info} />
      <Text style={styles.cardTitle} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.cardPath} numberOfLines={2}>
        {project.path}
      </Text>
      <Text style={styles.cardMeta}>{new Date(project.lastOpenedAt).toLocaleString()}</Text>
    </Pressable>
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
  listContent: {
    flexGrow: 1,
    paddingHorizontal: LIST_HORIZONTAL_PADDING,
    paddingBottom: space[4],
  },
  emptyListContent: { justifyContent: "center" },
  cardRow: { gap: CARD_GAP },
  card: {
    minHeight: 148,
    marginBottom: CARD_GAP,
    borderRadius: radius.panel,
    backgroundColor: color.surface,
    padding: space[4],
    gap: space[2],
  },
  cardPressed: { backgroundColor: wash.panel },
  cardTitle: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    fontWeight: "600",
    lineHeight: 22,
  },
  cardPath: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    lineHeight: 17,
  },
  cardMeta: {
    color: color.subtext,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    marginTop: "auto",
  },
  empty: { alignItems: "center", gap: space[2], paddingHorizontal: space[4] },
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
