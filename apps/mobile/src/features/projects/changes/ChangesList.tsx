import type { Change } from "@novelevolver/domain/worktree";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { color, fontFamily, fontSize, radius, space, wash } from "../../../shared/theme";

type ChangesListProps = {
  manuscriptChanges: Change[];
  resourceChanges: Change[];
  onRevert: (changeId: string) => void;
  onOpenChange: (change: Change) => void;
};

type ChangeRowItem =
  | { kind: "domain"; id: string; title: string; count: number }
  | { kind: "change"; id: string; change: Change };

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
  if (kind === "content" || kind === "rename" || kind === "move") return color.warning;
  return color.muted;
}

function canPreview(change: Change): boolean {
  return (
    (change.kind === "create" || change.kind === "delete" || change.kind === "content") &&
    (change.entityKind === "chapter" || change.entityKind === "file")
  );
}

export function ChangesList({
  manuscriptChanges,
  resourceChanges,
  onRevert,
  onOpenChange,
}: ChangesListProps) {
  const sections: ChangeRowItem[] = [];
  for (const [id, title, changes] of [
    ["manuscript", "正文变更", manuscriptChanges],
    ["resource", "资源变更", resourceChanges],
  ] as const) {
    if (changes.length === 0) continue;
    sections.push({ kind: "domain", id, title, count: changes.length });
    for (const change of changes) {
      sections.push({ kind: "change", id: change.id, change });
    }
  }

  return (
    <FlatList
      data={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) =>
        item.kind === "domain" ? (
          <View style={styles.domainRow}>
            <Text style={styles.domainTitle}>{item.title}</Text>
            <Text style={styles.count}>{item.count}</Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole={canPreview(item.change) ? "button" : undefined}
            accessibilityLabel={
              canPreview(item.change) ? `查看更改：${item.change.label}` : item.change.label
            }
            onPress={canPreview(item.change) ? () => onOpenChange(item.change) : undefined}
            style={({ pressed }) => [
              styles.changeRow,
              pressed && canPreview(item.change) && styles.pressed,
            ]}
          >
            <View style={[styles.kindMark, { backgroundColor: kindColor(item.change.kind) }]} />
            <View style={styles.changeContent}>
              <Text style={styles.label} numberOfLines={1}>
                {item.change.label}
              </Text>
              <Text style={styles.path} numberOfLines={1}>
                {item.change.displayPath}
              </Text>
            </View>
            <View style={styles.meta}>
              {item.change.stats ? (
                <Text style={styles.stats}>
                  <Text style={styles.added}>+{item.change.stats.added}</Text>{" "}
                  <Text style={styles.removed}>-{item.change.stats.removed}</Text>
                </Text>
              ) : null}
              <Text style={[styles.kind, { color: kindColor(item.change.kind) }]}>
                {kindLabel(item.change.kind)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`还原此变更：${item.change.label}`}
                hitSlop={8}
                onPress={() => onRevert(item.change.id)}
                style={({ pressed }) => [styles.revert, pressed && styles.revertPressed]}
              >
                <Text style={styles.revertText}>还原</Text>
              </Pressable>
            </View>
          </Pressable>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: space[4] },
  domainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  domainTitle: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  count: {
    minWidth: 24,
    paddingHorizontal: space[1],
    borderRadius: radius.pill,
    backgroundColor: wash.mutedFill,
    color: color.muted,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xxs,
    textAlign: "center",
  },
  changeRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  pressed: { backgroundColor: wash.row },
  kindMark: { width: 4, height: 28, borderRadius: radius.pill },
  changeContent: { flex: 1, minWidth: 0, gap: 2 },
  label: { color: color.foreground, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
  path: { color: color.muted, fontFamily: fontFamily.mono, fontSize: fontSize.xxs },
  meta: { alignItems: "flex-end", gap: 3 },
  stats: { fontFamily: fontFamily.mono, fontSize: fontSize.xxs },
  added: { color: color.success },
  removed: { color: color.error },
  kind: { fontFamily: fontFamily.sans, fontSize: fontSize.xxs },
  revert: {
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.control,
    backgroundColor: wash.dangerSoft,
  },
  revertPressed: { backgroundColor: wash.row },
  revertText: { color: color.error, fontFamily: fontFamily.sans, fontSize: fontSize.xxs },
});
