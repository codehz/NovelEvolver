import type { ManuscriptNode } from "@novelevolver/domain/worktree";
import { Header } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "../../app/navigation-types";
import {
  appFiles,
  copyPath,
  ensureDirectory,
  shareNpk,
} from "../../shared/files/mobile-file-bridge";
import { color, fontFamily, fontSize, radius, space, wash } from "../../shared/theme";
import { settingsStyles } from "../settings/settings-chrome";
import { SettingsHeaderBackButton } from "../settings/SettingsHeaderBackButton";
import { SettingsHeaderButton } from "../settings/SettingsHeaderButton";
import { InputPrompt } from "./InputPrompt";
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

type PromptState = { title: string; confirmLabel: string; onConfirm(value: string): void } | null;

export function ProjectScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const projectId = (route.params as RootStackParamList["Project"]).projectId;
  const manager = useProjectManager();
  const [opened, setOpened] = useState(
    manager.opened?.record.id === projectId ? manager.opened : null,
  );
  const [revision, setRevision] = useState(0);
  const [prompt, setPrompt] = useState<PromptState>(null);

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
        if (active) Alert.alert("打开失败", error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [manager, projectId]);

  if (opened === null) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.text}>正在打开项目…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const outline = opened.worktree.outline;
  const nodes = flattenNodes(outline);
  const update = () => {
    opened.worktree.flush();
    setRevision((value) => value + 1);
  };
  const move = (node: ManuscriptNode, parentId: string, index: number, direction: -1 | 1) => {
    opened.worktree.moveNode(node.id, parentId, index + direction);
    update();
  };
  const commit = (message: string) => {
    try {
      opened.worktree.commit(message);
      setPrompt(null);
      update();
      Alert.alert("提交完成", "当前 worktree 已写入 Git。");
    } catch (error) {
      Alert.alert("提交失败", error instanceof Error ? error.message : String(error));
    }
  };
  const exportProject = async () => {
    if (!opened.worktree.hasCommit) {
      Alert.alert("无法导出", "项目尚无提交，请先提交内容。");
      return;
    }
    if (opened.worktree.hasChanges) {
      Alert.alert("无法导出", "存在未提交修改，请先提交。");
      return;
    }
    try {
      await ensureDirectory(appFiles.cache);
      const output = `${appFiles.cache}/${opened.record.id}.npk`;
      await copyPath(opened.repositoryPath, output);
      await shareNpk(output, `${opened.record.displayName}.npk`);
    } catch (error) {
      Alert.alert("导出失败", error instanceof Error ? error.message : String(error));
    }
  };
  const deleteProject = () =>
    Alert.alert(
      "删除项目？",
      `将删除“${opened.record.displayName}”的本地仓库和草稿。外部文件不会被删除。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            void manager
              .deleteProject(projectId)
              .then(() => navigation.popToTop())
              .catch((error) => {
                Alert.alert("删除失败", error instanceof Error ? error.message : String(error));
              });
          },
        },
      ],
    );

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <Header
        title={opened.record.displayName}
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
              onPress={() =>
                setPrompt({
                  title: "重命名项目",
                  confirmLabel: "保存",
                  onConfirm: (name) => {
                    try {
                      const updated = manager.renameProject(projectId, name);
                      setOpened((current) =>
                        current === null ? current : { ...current, record: updated },
                      );
                      setPrompt(null);
                    } catch (error) {
                      Alert.alert(
                        "重命名失败",
                        error instanceof Error ? error.message : String(error),
                      );
                    }
                  },
                })
              }
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
          onPress={() =>
            setPrompt({ title: "提交当前 worktree", confirmLabel: "提交", onConfirm: commit })
          }
        >
          <Text style={styles.primaryText}>提交</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            setPrompt({
              title: "新建文件夹",
              confirmLabel: "创建",
              onConfirm: (name) => {
                try {
                  opened.worktree.createFolder(outline.rootId, name);
                  setPrompt(null);
                  update();
                } catch (error) {
                  Alert.alert("创建失败", error instanceof Error ? error.message : String(error));
                }
              },
            })
          }
        >
          <Text style={styles.secondaryText}>文件夹</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() =>
            setPrompt({
              title: "新建章节",
              confirmLabel: "创建",
              onConfirm: (name) => {
                try {
                  const id = opened.worktree.createChapter(outline.rootId, name);
                  setPrompt(null);
                  update();
                  navigation.navigate("Chapter", { projectId, nodeId: id });
                } catch (error) {
                  Alert.alert("创建失败", error instanceof Error ? error.message : String(error));
                }
              },
            })
          }
        >
          <Text style={styles.secondaryText}>章节</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={deleteProject}>
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
                onPress={() =>
                  setPrompt({
                    title: "重命名",
                    confirmLabel: "保存",
                    onConfirm: (name) => {
                      try {
                        opened.worktree.renameNode(node.id, name);
                        setPrompt(null);
                        update();
                      } catch (error) {
                        Alert.alert(
                          "重命名失败",
                          error instanceof Error ? error.message : String(error),
                        );
                      }
                    },
                  })
                }
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
                onPress={() =>
                  Alert.alert("删除节点？", `将递归删除“${node.title}”及其子项。`, [
                    { text: "取消", style: "cancel" },
                    {
                      text: "删除",
                      style: "destructive",
                      onPress: () => {
                        try {
                          opened.worktree.deleteNode(node.id);
                          update();
                        } catch (error) {
                          Alert.alert(
                            "删除失败",
                            error instanceof Error ? error.message : String(error),
                          );
                        }
                      },
                    },
                  ])
                }
              >
                <Text style={styles.dangerText}>删</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
      <InputPrompt
        visible={prompt !== null}
        title={prompt?.title ?? ""}
        confirmLabel={prompt?.confirmLabel ?? "确认"}
        onCancel={() => setPrompt(null)}
        onConfirm={(value) => prompt?.onConfirm(value)}
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
