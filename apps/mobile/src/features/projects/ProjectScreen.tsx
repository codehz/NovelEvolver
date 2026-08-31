import type { ManuscriptNode } from "@novelevolver/domain/worktree";
import { Header } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "../../app/navigation-types";
import {
  appFiles,
  copyPath,
  ensureDirectory,
  shareNpk,
} from "../../shared/files/mobile-file-bridge";
import { color, fontFamily, fontSize, radius, space, wash } from "../../shared/theme";
import { useOverlay } from "../../shared/ui/OverlayHost";
import { settingsStyles } from "../settings/settings-chrome";
import { SettingsHeaderBackButton } from "../settings/SettingsHeaderBackButton";
import { SettingsHeaderButton } from "../settings/SettingsHeaderButton";
import { useProjectManager } from "./ProjectManagerProvider";

function flattenNodes(outline: { rootId: string; nodes: Record<string, ManuscriptNode> }) {
  const result: Array<{ node: ManuscriptNode; depth: number; parentId: string; index: number }> =
    [];
  const walk = (parentId: string, depth: number) => {
    const parent = outline.nodes[parentId];
    if (parent?.type !== "folder") return;
    parent.children.forEach((id, index) => {
      const node = outline.nodes[id];
      if (node === undefined) return;
      result.push({ node, depth, parentId, index });
      if (node.type === "folder") walk(node.id, depth + 1);
    });
  };
  walk(outline.rootId, 0);
  return result;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ProjectScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const overlay = useOverlay();
  const route = useRoute();
  const projectId = (route.params as RootStackParamList["Project"]).projectId;
  const manager = useProjectManager();
  const [opened, setOpened] = useState(
    manager.opened?.record.id === projectId ? manager.opened : null,
  );
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    const current = manager.opened?.record.id === projectId ? manager.opened : null;
    if (current !== null) {
      setOpened(current);
      return () => {
        active = false;
      };
    }
    const record = manager.records.find((item) => item.id === projectId);
    if (record === undefined)
      return () => {
        active = false;
      };
    void manager
      .openProject(record)
      .then((result) => {
        if (active) setOpened(result);
      })
      .catch((error) => {
        if (active) {
          void overlay.alert({ title: "打开失败", message: errorMessage(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [manager, overlay, projectId]);

  if (opened === null) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.text}>正在打开项目…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const outline = opened.worktree.getManuscriptOutline();
  const nodes = flattenNodes(outline);
  const update = () => {
    setRevision((value) => value + 1);
  };
  const move = (node: ManuscriptNode, parentId: string, index: number, direction: -1 | 1) => {
    opened.worktree.moveManuscriptNode(node.id, parentId, index + direction);
    update();
  };
  const renameProject = async () => {
    const name = await overlay.prompt({
      title: "重命名项目",
      initialValue: opened.record.displayName ?? "",
      confirmLabel: "保存",
    });
    if (name === null) return;
    try {
      const updated = manager.renameProject(projectId, name);
      setOpened((current) => (current === null ? current : { ...current, record: updated }));
    } catch (error) {
      await overlay.alert({ title: "重命名失败", message: errorMessage(error) });
    }
  };
  const commitWorktree = async () => {
    const message = await overlay.prompt({
      title: "提交当前 worktree",
      placeholder: "提交说明",
      confirmLabel: "提交",
    });
    if (message === null) return;
    try {
      opened.worktree.commitChanges(message, {
        name: "NovelEvolver",
        email: "app@novel-evolver.local",
      });
      update();
      await overlay.alert({ title: "提交完成", message: "当前 worktree 已写入 Git。" });
    } catch (error) {
      await overlay.alert({ title: "提交失败", message: errorMessage(error) });
    }
  };
  const createFolder = async () => {
    const name = await overlay.prompt({
      title: "新建文件夹",
      placeholder: "文件夹名称",
      confirmLabel: "创建",
    });
    if (name === null) return;
    try {
      opened.worktree.createManuscriptFolder(outline.rootId, name);
      update();
    } catch (error) {
      await overlay.alert({ title: "创建失败", message: errorMessage(error) });
    }
  };
  const createChapter = async () => {
    const name = await overlay.prompt({
      title: "新建章节",
      placeholder: "章节名称",
      confirmLabel: "创建",
    });
    if (name === null) return;
    try {
      const { nodeId } = opened.worktree.createManuscriptChapter(outline.rootId, name);
      update();
      navigation.navigate("Chapter", { projectId, nodeId });
    } catch (error) {
      await overlay.alert({ title: "创建失败", message: errorMessage(error) });
    }
  };
  const renameNode = async (node: ManuscriptNode) => {
    const name = await overlay.prompt({
      title: "重命名",
      initialValue: node.title,
      confirmLabel: "保存",
    });
    if (name === null) return;
    try {
      opened.worktree.renameManuscriptNode(node.id, name);
      update();
    } catch (error) {
      await overlay.alert({ title: "重命名失败", message: errorMessage(error) });
    }
  };
  const deleteNode = async (node: ManuscriptNode) => {
    const confirmed = await overlay.confirm({
      title: "删除节点？",
      message: `将递归删除“${node.title}”及其子项。`,
      confirmLabel: "删除",
    });
    if (!confirmed) return;
    try {
      opened.worktree.deleteManuscriptNode(node.id);
      update();
    } catch (error) {
      await overlay.alert({ title: "删除失败", message: errorMessage(error) });
    }
  };
  const exportProject = async () => {
    if (!opened.worktree.hasCommittedTip()) {
      await overlay.alert({ title: "无法导出", message: "项目尚无提交，请先提交内容。" });
      return;
    }
    if (opened.worktree.hasPendingChanges()) {
      await overlay.alert({ title: "无法导出", message: "存在未提交修改，请先提交。" });
      return;
    }
    try {
      await ensureDirectory(appFiles.cache);
      const output = `${appFiles.cache}/${opened.record.id}.npk`;
      await copyPath(opened.repositoryPath, output);
      await shareNpk(output, `${opened.record.displayName ?? "project"}.npk`);
    } catch (error) {
      await overlay.alert({ title: "导出失败", message: errorMessage(error) });
    }
  };
  const deleteProject = async () => {
    const confirmed = await overlay.confirm({
      title: "删除项目？",
      message: `将删除“${opened.record.displayName ?? "未命名项目"}”的本地仓库和草稿。外部文件不会被删除。`,
      confirmLabel: "删除",
    });
    if (!confirmed) return;
    try {
      await manager.deleteProject(projectId);
      navigation.popToTop();
    } catch (error) {
      await overlay.alert({ title: "删除失败", message: errorMessage(error) });
    }
  };

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <Header
        title={opened.record.displayName ?? "未命名项目"}
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
      <View style={styles.toolbar}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            void commitWorktree();
          }}
        >
          <Text style={styles.primaryText}>提交</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void createFolder();
          }}
        >
          <Text style={styles.secondaryText}>文件夹</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void createChapter();
          }}
        >
          <Text style={styles.secondaryText}>章节</Text>
        </Pressable>
        <Pressable
          style={styles.dangerButton}
          onPress={() => {
            void deleteProject();
          }}
        >
          <Text style={styles.dangerText}>删除</Text>
        </Pressable>
      </View>
      {opened.worktree.warning !== null && (
        <Text style={styles.warning}>{opened.worktree.warning}</Text>
      )}
      <ScrollView contentContainerStyle={styles.tree} key={revision}>
        {nodes.length === 0 ? (
          <Text style={styles.emptyText}>空 manuscript。使用上方按钮创建文件夹或章节。</Text>
        ) : (
          nodes.map(({ node, depth, parentId, index }) => (
            <View
              key={node.id}
              style={[styles.nodeRow, { paddingLeft: space[3] + depth * space[4] }]}
            >
              <Pressable
                style={styles.nodeMain}
                onPress={() =>
                  node.type === "chapter" &&
                  navigation.navigate("Chapter", { projectId, nodeId: node.id })
                }
              >
                <Text style={styles.nodeIcon}>{node.type === "folder" ? "▾" : "·"}</Text>
                <Text style={styles.nodeTitle}>{node.title}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void renameNode(node);
                }}
              >
                <Text style={styles.actionText}>改名</Text>
              </Pressable>
              <Pressable onPress={() => move(node, parentId, index, -1)} disabled={index === 0}>
                <Text style={[styles.actionText, index === 0 && styles.disabled]}>↑</Text>
              </Pressable>
              <Pressable onPress={() => move(node, parentId, index, 1)}>
                <Text style={styles.actionText}>↓</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void deleteNode(node);
                }}
              >
                <Text style={styles.dangerText}>删</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
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
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: space[2], padding: space[3] },
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
  secondaryText: { color: color.foreground, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
  dangerButton: {
    borderRadius: radius.control,
    backgroundColor: wash.dangerSoft,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  warning: {
    color: color.warning,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    paddingHorizontal: space[3],
    paddingBottom: space[2],
  },
  dangerText: { color: color.error, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
  tree: { paddingBottom: space[8] },
  nodeRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingRight: space[3],
  },
  nodeMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: space[2] },
  nodeIcon: { color: color.accent, fontSize: fontSize.md, width: 16, textAlign: "center" },
  nodeTitle: { color: color.foreground, fontFamily: fontFamily.sans, fontSize: fontSize.md },
  actionText: { color: color.accent, fontFamily: fontFamily.sans, fontSize: fontSize.xs },
  disabled: { color: color.placeholder },
  emptyText: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    textAlign: "center",
    padding: space[6],
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
});
