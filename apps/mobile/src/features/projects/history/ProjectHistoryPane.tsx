import type { Change, CommitChangesSnapshot, CommitSummary } from "@novelevolver/domain/worktree";
import type { WorktreeSession } from "@novelevolver/worktree";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import IconBook from "~icons/codicon/book";
import IconChevronDown from "~icons/codicon/chevron-down";
import IconChevronRight from "~icons/codicon/chevron-right";
import IconError from "~icons/codicon/error";
import IconFile from "~icons/codicon/file";
import IconFiles from "~icons/codicon/files";
import IconGitCommit from "~icons/codicon/git-commit";
import IconHistory from "~icons/codicon/history";
import IconLoading from "~icons/codicon/loading";

import { color, fontFamily, fontSize, radius, space, wash } from "../../../shared/theme";

const HISTORY_MAX_COMMITS = 100;

type CommitChangesState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; snapshot: CommitChangesSnapshot };

type ProjectHistoryPaneProps = {
  worktree: WorktreeSession;
  refreshKey: number;
};

function formatCommitTime(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}

function kindLabel(kind: Change["kind"]): string {
  switch (kind) {
    case "create":
      return "新增";
    case "delete":
      return "删除";
    case "rename":
      return "重命名";
    case "move":
      return "移动";
    case "reorder":
      return "排序";
    case "content":
      return "修改";
  }
}

function kindColor(kind: Change["kind"]): string {
  if (kind === "create") return color.success;
  if (kind === "delete") return color.error;
  if (kind === "reorder") return color.muted;
  return color.warning;
}

function HistoryStatus({
  kind,
  onRetry,
}: {
  kind: "empty" | "error" | "loading";
  onRetry?: () => void;
}) {
  const title =
    kind === "loading"
      ? "正在加载提交历史…"
      : kind === "error"
        ? "无法加载提交历史。"
        : "此分支尚无提交记录。";
  const Icon = kind === "loading" ? IconLoading : kind === "error" ? IconError : IconHistory;
  const iconColor =
    kind === "error" ? color.error : kind === "loading" ? color.accent : color.muted;
  return (
    <View style={styles.status}>
      <Icon width={30} height={30} color={iconColor} />
      <Text style={styles.statusText}>{title}</Text>
      {kind === "error" && onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>重试</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ChangeRow({ change }: { change: Change }) {
  const changeColor = kindColor(change.kind);
  return (
    <View style={styles.changeRow}>
      <IconFile width={15} height={15} color={color.muted} />
      <View style={styles.changeContent}>
        <Text style={styles.changeLabel} numberOfLines={1}>
          {change.label}
        </Text>
        <Text style={styles.changePath} numberOfLines={1}>
          {change.displayPath}
        </Text>
      </View>
      {change.stats ? (
        <Text style={styles.stats}>
          <Text style={styles.added}>+{change.stats.added}</Text>{" "}
          <Text style={styles.removed}>-{change.stats.removed}</Text>
        </Text>
      ) : null}
      <Text style={[styles.changeKind, { color: changeColor }]}>{kindLabel(change.kind)}</Text>
    </View>
  );
}

function ChangeSection({
  title,
  domain,
  changes,
}: {
  title: string;
  domain: "manuscript" | "resource";
  changes: Change[];
}) {
  if (changes.length === 0) return null;
  const Icon = domain === "manuscript" ? IconBook : IconFiles;
  return (
    <View>
      <View style={styles.domainRow}>
        <Icon width={16} height={16} color={color.muted} />
        <Text style={styles.domainTitle}>{title}</Text>
        <Text style={styles.count}>{changes.length}</Text>
      </View>
      {changes.map((change) => (
        <ChangeRow key={change.id} change={change} />
      ))}
    </View>
  );
}

type CommitRowProps = {
  commit: CommitSummary;
  isHead: boolean;
  expanded: boolean;
  changesState: CommitChangesState | undefined;
  onToggle: () => void;
  onRetry: () => void;
};

function CommitRow({ commit, isHead, expanded, changesState, onToggle, onRetry }: CommitRowProps) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${commit.message}，${commit.shortHash}，${commit.authorName}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.commitRow, pressed && styles.pressed]}
      >
        {expanded ? (
          <IconChevronDown width={16} height={16} color={color.muted} />
        ) : (
          <IconChevronRight width={16} height={16} color={color.muted} />
        )}
        {isHead ? (
          <View style={styles.headDot} />
        ) : (
          <IconGitCommit width={7} height={7} color={color.muted} />
        )}
        <View style={styles.commitContent}>
          <Text style={styles.commitMessage} numberOfLines={1}>
            {commit.message}
          </Text>
          <Text style={styles.commitMeta} numberOfLines={1}>
            {commit.shortHash} · {formatCommitTime(commit.committedAt)} · {commit.authorName}
          </Text>
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.expandedBody}>
          {changesState === undefined || changesState.status === "loading" ? (
            <View style={styles.inlineStatus}>
              <IconLoading width={16} height={16} color={color.accent} />
              <Text style={styles.inlineStatusText}>正在加载提交变更…</Text>
            </View>
          ) : changesState.status === "error" ? (
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={({ pressed }) => [styles.inlineStatus, pressed && styles.pressed]}
            >
              <IconError width={16} height={16} color={color.error} />
              <Text style={styles.inlineStatusText}>无法加载提交变更，点按重试</Text>
            </Pressable>
          ) : changesState.snapshot.manuscriptChanges.length === 0 &&
            changesState.snapshot.resourceChanges.length === 0 ? (
            <Text style={styles.emptyChanges}>此提交无文件变更。</Text>
          ) : (
            <>
              <ChangeSection
                title="正文"
                domain="manuscript"
                changes={changesState.snapshot.manuscriptChanges}
              />
              <ChangeSection
                title="资源库"
                domain="resource"
                changes={changesState.snapshot.resourceChanges}
              />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function ProjectHistoryPane({ worktree, refreshKey }: ProjectHistoryPaneProps) {
  const [commits, setCommits] = useState<CommitSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [expandedHashes, setExpandedHashes] = useState<Set<string>>(() => new Set());
  const [changesByCommit, setChangesByCommit] = useState<Map<string, CommitChangesState>>(
    () => new Map(),
  );

  useEffect(() => {
    setLoading(true);
    setError(false);
    try {
      setCommits(worktree.listBranchCommits(HISTORY_MAX_COMMITS));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [refreshKey, retryKey, worktree]);

  const loadChanges = (commitHash: string) => {
    setChangesByCommit((current) => new Map(current).set(commitHash, { status: "loading" }));
    try {
      const snapshot = worktree.listCommitChanges(commitHash);
      setChangesByCommit((current) =>
        new Map(current).set(commitHash, { status: "ready", snapshot }),
      );
    } catch {
      setChangesByCommit((current) => new Map(current).set(commitHash, { status: "error" }));
    }
  };

  const toggleCommit = (commitHash: string) => {
    if (expandedHashes.has(commitHash)) {
      setExpandedHashes((current) => {
        const next = new Set(current);
        next.delete(commitHash);
        return next;
      });
      return;
    }
    setExpandedHashes((current) => new Set(current).add(commitHash));
    const state = changesByCommit.get(commitHash);
    if (state === undefined || state.status === "error") loadChanges(commitHash);
  };

  if (loading && commits === null) return <HistoryStatus kind="loading" />;
  if (error) {
    return <HistoryStatus kind="error" onRetry={() => setRetryKey((value) => value + 1)} />;
  }
  if (commits === null || commits.length === 0) return <HistoryStatus kind="empty" />;

  return (
    <FlatList
      data={commits}
      extraData={[expandedHashes, changesByCommit]}
      keyExtractor={(commit) => commit.hash}
      contentContainerStyle={styles.list}
      renderItem={({ item, index }) => (
        <CommitRow
          commit={item}
          isHead={index === 0}
          expanded={expandedHashes.has(item.hash)}
          changesState={changesByCommit.get(item.hash)}
          onToggle={() => toggleCommit(item.hash)}
          onRetry={() => loadChanges(item.hash)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: space[1] },
  status: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    padding: space[4],
  },
  statusText: {
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
  commitRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  pressed: { backgroundColor: wash.row },
  headDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: color.accent },
  commitContent: { flex: 1, minWidth: 0, gap: 3 },
  commitMessage: {
    color: color.subtext,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
  },
  commitMeta: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xxs,
  },
  expandedBody: { backgroundColor: wash.panel },
  inlineStatus: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[6],
    paddingVertical: space[2],
  },
  inlineStatusText: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.xxs },
  emptyChanges: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xxs,
    paddingHorizontal: space[6],
    paddingVertical: space[3],
  },
  domainRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingLeft: space[6],
    paddingRight: space[3],
  },
  domainTitle: {
    flex: 1,
    color: color.subtext,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  count: {
    minWidth: 22,
    paddingHorizontal: space[1],
    borderRadius: radius.pill,
    backgroundColor: wash.mutedFill,
    color: color.muted,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xxs,
    textAlign: "center",
  },
  changeRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingLeft: space[8],
    paddingRight: space[3],
    paddingVertical: space[1],
  },
  changeContent: { flex: 1, minWidth: 0, gap: 2 },
  changeLabel: { color: color.subtext, fontFamily: fontFamily.sans, fontSize: fontSize.xs },
  changePath: { color: color.muted, fontFamily: fontFamily.mono, fontSize: fontSize.xxs },
  stats: { flexShrink: 0, fontFamily: fontFamily.mono, fontSize: fontSize.xxs },
  added: { color: color.success },
  removed: { color: color.error },
  changeKind: { flexShrink: 0, fontFamily: fontFamily.sans, fontSize: fontSize.xxs },
});
