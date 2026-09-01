import type {
  ManuscriptNode,
  ManuscriptOutline,
  ResourceTreeNode,
  ResourceTreeSnapshot,
  WorktreeDomain,
} from "@novelevolver/domain/worktree";
import { Header } from "@react-navigation/elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { RootStackParamList } from "../../app/navigation-types";
import {
  appFiles,
  copyPath,
  ensureDirectory,
  shareNpk,
} from "../../shared/files/mobile-file-bridge";
import { color, fontFamily, fontSize } from "../../shared/theme";
import { useOverlay } from "../../shared/ui/OverlayHost";
import { settingsStyles } from "../settings/settings-chrome";
import { SettingsHeaderBackButton } from "../settings/SettingsHeaderBackButton";
import { SettingsHeaderButton } from "../settings/SettingsHeaderButton";
import { useProjectManager } from "./ProjectManagerProvider";
import { ProjectWorkspace } from "./ProjectWorkspace";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function containsManuscriptNode(
  outline: ManuscriptOutline,
  ancestorId: string,
  targetId: string,
): boolean {
  if (ancestorId === targetId) return true;
  const node = outline.nodes[ancestorId];
  if (node?.type !== "folder") return false;
  return node.children.some((childId) => containsManuscriptNode(outline, childId, targetId));
}

function containsResourceNode(
  tree: ResourceTreeSnapshot,
  ancestorId: string,
  targetId: string,
): boolean {
  if (ancestorId === targetId) return true;
  const node = tree.nodes[ancestorId];
  if (node?.type !== "folder") return false;
  return node.childIds.some((childId) => containsResourceNode(tree, childId, targetId));
}

function resourceCreateParentId(tree: ResourceTreeSnapshot, selectedId: string | null): string {
  if (selectedId === null) return tree.rootId;
  const node = tree.nodes[selectedId];
  if (node?.type === "folder") return node.id;
  return node?.parentId ?? tree.rootId;
}

export function ProjectScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const overlay = useOverlay();
  const projectId = (route.params as RootStackParamList["Project"]).projectId;
  const manager = useProjectManager();
  const [opened, setOpened] = useState(
    manager.opened?.record.id === projectId ? manager.opened : null,
  );
  const [explorerDomain, setExplorerDomain] = useState<WorktreeDomain>("manuscript");
  const [selectedManuscriptId, setSelectedManuscriptId] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [, setRevision] = useState(0);

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
  const resourceTree = opened.worktree.getResourceTree();
  const update = () => {
    setRevision((value) => value + 1);
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
  const createChapter = async (): Promise<boolean> => {
    const name = await overlay.prompt({
      title: "新建章节",
      placeholder: "章节名称",
      confirmLabel: "创建",
    });
    if (name === null) return false;
    try {
      const { nodeId } = opened.worktree.createManuscriptChapter(outline.rootId, name);
      update();
      setSelectedManuscriptId(nodeId);
      return true;
    } catch (error) {
      await overlay.alert({ title: "创建失败", message: errorMessage(error) });
      return false;
    }
  };
  const createResourceFolder = async () => {
    const name = await overlay.prompt({
      title: "新建文件夹",
      placeholder: "文件夹名称",
      confirmLabel: "创建",
    });
    if (name === null) return;
    try {
      opened.worktree.createResourceFolder(
        resourceCreateParentId(resourceTree, selectedResourceId),
        name,
      );
      update();
    } catch (error) {
      await overlay.alert({ title: "创建失败", message: errorMessage(error) });
    }
  };
  const createResourceFile = async (): Promise<boolean> => {
    const name = await overlay.prompt({
      title: "新建文件",
      placeholder: "文件名称",
      confirmLabel: "创建",
    });
    if (name === null) return false;
    try {
      const { nodeId } = opened.worktree.createResourceFile(
        resourceCreateParentId(resourceTree, selectedResourceId),
        name,
      );
      update();
      setSelectedResourceId(nodeId);
      return true;
    } catch (error) {
      await overlay.alert({ title: "创建失败", message: errorMessage(error) });
      return false;
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
      if (containsManuscriptNode(outline, node.id, selectedManuscriptId ?? "")) {
        setSelectedManuscriptId(null);
      }
      update();
    } catch (error) {
      await overlay.alert({ title: "删除失败", message: errorMessage(error) });
    }
  };
  const moveNode = (sourceId: string, parentId: string, index?: number) => {
    try {
      opened.worktree.moveManuscriptNode(sourceId, parentId, index);
      update();
    } catch (error) {
      void overlay.alert({ title: "移动失败", message: errorMessage(error) });
    }
  };
  const renameResource = async (node: ResourceTreeNode) => {
    const name = await overlay.prompt({
      title: "重命名",
      initialValue: node.name,
      confirmLabel: "保存",
    });
    if (name === null) return;
    try {
      opened.worktree.renameResourceNode(node.id, name);
      update();
    } catch (error) {
      await overlay.alert({ title: "重命名失败", message: errorMessage(error) });
    }
  };
  const deleteResource = async (node: ResourceTreeNode) => {
    const confirmed = await overlay.confirm({
      title: "删除节点？",
      message: `将递归删除“${node.name}”及其子项。`,
      confirmLabel: "删除",
    });
    if (!confirmed) return;
    try {
      opened.worktree.deleteResourceNode(node.id);
      if (containsResourceNode(resourceTree, node.id, selectedResourceId ?? "")) {
        setSelectedResourceId(null);
      }
      update();
    } catch (error) {
      await overlay.alert({ title: "删除失败", message: errorMessage(error) });
    }
  };
  const moveResource = (sourceId: string, parentId: string) => {
    try {
      opened.worktree.moveResourceNode(sourceId, parentId);
      update();
    } catch (error) {
      void overlay.alert({ title: "移动失败", message: errorMessage(error) });
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
      <ProjectWorkspace
        opened={opened}
        domain={explorerDomain}
        onDomainChange={setExplorerDomain}
        outline={outline}
        resourceTree={resourceTree}
        selectedManuscriptId={selectedManuscriptId}
        selectedResourceId={selectedResourceId}
        warning={opened.worktree.warning}
        onOpenChapter={setSelectedManuscriptId}
        onOpenResourceFile={setSelectedResourceId}
        onRenameManuscript={(node) => {
          void renameNode(node);
        }}
        onDeleteManuscript={(node) => {
          void deleteNode(node);
        }}
        onMoveManuscript={moveNode}
        onRenameResource={(node) => {
          void renameResource(node);
        }}
        onDeleteResource={(node) => {
          void deleteResource(node);
        }}
        onMoveResource={moveResource}
        onCreateFolder={() => {
          void createFolder();
        }}
        onCreateChapter={createChapter}
        onCreateResourceFolder={() => {
          void createResourceFolder();
        }}
        onCreateResourceFile={createResourceFile}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
});
