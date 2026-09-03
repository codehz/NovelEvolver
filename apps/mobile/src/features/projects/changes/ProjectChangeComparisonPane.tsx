import type { ChangeTextComparison } from "@novelevolver/domain/worktree";
import type { WorktreeSession } from "@novelevolver/worktree";
import { useEffect, useState, type ReactNode } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import IconArrowLeft from "~icons/codicon/arrow-left";
import IconDiscard from "~icons/codicon/discard";
import IconError from "~icons/codicon/error";
import IconLoading from "~icons/codicon/loading";

import { color, fontFamily, fontSize, radius, space, wash } from "../../../shared/theme";
import { useOverlay } from "../../../shared/ui/OverlayHost";
import type { ProjectComparisonTarget } from "../use-project-workspace";
import { buildChangeComparisonModel, type ComparisonLine } from "./change-comparison";

type ProjectChangeComparisonPaneProps = {
  worktree: WorktreeSession;
  target: ProjectComparisonTarget;
  revision: number;
  onChanged: () => void;
  onClose: () => void;
  showHeader?: boolean;
};

function lineColor(line: ComparisonLine): string {
  if (line.kind === "added") return color.success;
  if (line.kind === "removed") return color.error;
  return color.foreground;
}

function lineBackground(line: ComparisonLine): string {
  if (line.kind === "added") return wash.accentSoft;
  if (line.kind === "removed") return wash.dangerSoft;
  return color.background;
}

function linePrefix(line: ComparisonLine): string {
  if (line.kind === "added") return "+";
  if (line.kind === "removed") return "−";
  return " ";
}

export function ProjectChangeComparisonPane({
  worktree,
  target,
  revision,
  onChanged,
  onClose,
  showHeader = true,
}: ProjectChangeComparisonPaneProps) {
  const overlay = useOverlay();
  const [comparison, setComparison] = useState<ChangeTextComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [restoringHunkId, setRestoringHunkId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    try {
      setComparison(
        target.kind === "change"
          ? worktree.readChangeTextComparison(target.changeId)
          : worktree.readCommitChangeTextComparison(target.commitHash, target.target),
      );
    } catch {
      setComparison(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [revision, target, worktree]);

  const restoreHunk = async (hunkId: string, restoredContent: string) => {
    if (comparison === null || restoringHunkId !== null) return;
    setRestoringHunkId(hunkId);
    try {
      worktree.restoreChangeTextHunk(comparison.target, comparison.currentContent, restoredContent);
      onChanged();
    } catch (restoreError) {
      await overlay.alert({
        title: "局部回滚失败",
        message:
          restoreError instanceof Error
            ? restoreError.message
            : "当前内容已变化，请重新打开差异预览后再试。",
      });
    } finally {
      setRestoringHunkId(null);
    }
  };

  const adoptHistoryVersion = async (version: "parent" | "commit") => {
    if (comparison === null || target.kind !== "commit") return;
    const confirmed = await overlay.confirm({
      title: version === "parent" ? "采用父版本到工作区" : "采用提交版本到工作区",
      message:
        version === "parent"
          ? "将当前文件恢复为该提交的父版本内容，覆盖工作区草稿。分支 tip 不会移动。"
          : "将当前文件恢复为该提交中的内容，覆盖工作区草稿。分支 tip 不会移动。",
      confirmLabel: version === "parent" ? "采用父版本" : "采用提交版本",
    });
    if (!confirmed) return;
    setRestoringHunkId(version);
    try {
      if (version === "commit") {
        worktree.restoreEntityFromCommit(target.commitHash, target.target);
      } else {
        const snapshot = worktree.listCommitChanges(target.commitHash);
        if (snapshot.parentHash !== null) {
          try {
            worktree.restoreEntityFromCommit(snapshot.parentHash, target.target);
          } catch {
            worktree.restoreEntityFromCommit(target.commitHash, target.target);
            worktree.restoreChangeTextHunk(
              target.target,
              comparison.currentContent,
              comparison.originalContent,
            );
          }
        } else {
          worktree.restoreEntityFromCommit(target.commitHash, target.target);
          worktree.restoreChangeTextHunk(
            target.target,
            comparison.currentContent,
            comparison.originalContent,
          );
        }
      }
      onChanged();
    } catch (restoreError) {
      await overlay.alert({
        title: "采用版本失败",
        message: restoreError instanceof Error ? restoreError.message : "当前内容已变化，请重试。",
      });
    } finally {
      setRestoringHunkId(null);
    }
  };

  const isCommitComparison = target.kind === "commit";

  const content = loading ? (
    <Status
      icon={<IconLoading width={28} height={28} color={color.accent} />}
      text="正在加载差异…"
    />
  ) : error || comparison === null ? (
    <Status
      icon={<IconError width={28} height={28} color={color.error} />}
      text="无法加载差异预览。"
    />
  ) : (
    <FlatList
      data={buildChangeComparisonModel(comparison.originalContent, comparison.currentContent).lines}
      keyExtractor={(line) => line.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <ComparisonLineRow line={item} />}
      ListHeaderComponent={
        <ComparisonSummary
          comparison={comparison}
          onRestore={(hunkId, restoredContent) => {
            void restoreHunk(hunkId, restoredContent);
          }}
          isCommitComparison={isCommitComparison}
          onAdopt={(version) => {
            void adoptHistoryVersion(version);
          }}
          restoringHunkId={restoringHunkId}
        />
      }
    />
  );

  return (
    <View style={styles.root}>
      {showHeader ? (
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭差异预览"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <IconArrowLeft width={20} height={20} color={color.accent} />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.title} numberOfLines={1}>
              {comparison?.label ?? "更改预览"}
            </Text>
            <Text style={styles.path} numberOfLines={1}>
              {comparison?.displayPath ?? ""}
            </Text>
          </View>
          <Text style={styles.mode}>只读</Text>
        </View>
      ) : null}
      {content}
    </View>
  );
}

function ComparisonSummary({
  comparison,
  restoringHunkId,
  onRestore,
  isCommitComparison,
  onAdopt,
}: {
  comparison: ChangeTextComparison;
  restoringHunkId: string | null;
  onRestore: (hunkId: string, restoredContent: string) => void;
  isCommitComparison: boolean;
  onAdopt: (version: "parent" | "commit") => void;
}) {
  const model = buildChangeComparisonModel(comparison.originalContent, comparison.currentContent);
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryText}>
        显示{isCommitComparison ? "父版本与提交版本" : "基线与当前工作区"}的差异 ·{" "}
        {model.hunks.length} 个差异块
      </Text>
      {isCommitComparison ? (
        <View style={styles.adoptRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="采用父版本"
            disabled={restoringHunkId !== null}
            onPress={() => onAdopt("parent")}
            style={({ pressed }) => [styles.adopt, styles.parentAdopt, pressed && styles.pressed]}
          >
            <Text style={styles.adoptText}>采用父版本</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="采用提交版本"
            disabled={restoringHunkId !== null}
            onPress={() => onAdopt("commit")}
            style={({ pressed }) => [styles.adopt, styles.commitAdopt, pressed && styles.pressed]}
          >
            <Text style={styles.adoptText}>采用提交版本</Text>
          </Pressable>
        </View>
      ) : null}
      {!isCommitComparison
        ? model.hunks.map((hunk) => (
            <Pressable
              key={hunk.id}
              accessibilityRole="button"
              accessibilityLabel="回滚此块"
              disabled={restoringHunkId !== null}
              onPress={() => onRestore(hunk.id, hunk.restoredContent)}
              style={({ pressed }) => [
                styles.restore,
                restoringHunkId !== null && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <IconDiscard width={15} height={15} color={color.error} />
              <Text style={styles.restoreText}>
                {restoringHunkId === hunk.id ? "正在回滚…" : "回滚此块"}
              </Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

function ComparisonLineRow({ line }: { line: ComparisonLine }) {
  return (
    <View style={[styles.line, { backgroundColor: lineBackground(line) }]}>
      <Text style={[styles.lineNumber, { color: lineColor(line) }]}>
        {line.number === null ? "·" : line.number}
      </Text>
      <Text style={[styles.prefix, { color: lineColor(line) }]}>{linePrefix(line)}</Text>
      <Text style={[styles.lineText, { color: lineColor(line) }]}>{line.text || " "}</Text>
    </View>
  );
}

function Status({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.status}>
      {icon}
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, backgroundColor: color.background },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[4],
    backgroundColor: color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  close: { padding: space[1] },
  headerContent: { flex: 1, minWidth: 0 },
  title: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  path: { color: color.muted, fontFamily: fontFamily.mono, fontSize: fontSize.xxs, marginTop: 2 },
  mode: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.xxs },
  list: { paddingBottom: space[4] },
  summary: {
    padding: space[3],
    gap: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  summaryText: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.xxs },
  restore: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.control,
    backgroundColor: wash.dangerSoft,
  },
  restoreText: { color: color.error, fontFamily: fontFamily.sans, fontSize: fontSize.xxs },
  adoptRow: { flexDirection: "row", gap: space[2] },
  adopt: {
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.control,
  },
  parentAdopt: { backgroundColor: wash.panel },
  commitAdopt: { backgroundColor: wash.accentSoft },
  adoptText: { color: color.accent, fontFamily: fontFamily.sans, fontSize: fontSize.xxs },
  line: { minHeight: 28, flexDirection: "row", alignItems: "center", paddingRight: space[3] },
  lineNumber: {
    width: 40,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xxs,
    textAlign: "right",
  },
  prefix: { width: 20, fontFamily: fontFamily.mono, fontSize: fontSize.xs, textAlign: "center" },
  lineText: { flex: 1, fontFamily: fontFamily.mono, fontSize: fontSize.xs, lineHeight: 20 },
  status: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    padding: space[4],
  },
  statusText: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
});
