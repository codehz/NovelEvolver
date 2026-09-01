import type { ManuscriptNode, ManuscriptOutline } from "@novelevolver/domain/worktree";
import { useRef, useState, type ComponentRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { color, fontFamily, fontSize, space } from "../../../shared/theme";
import { flattenVisibleManuscriptRows } from "./manuscript-tree-flatten";
import {
  dropKey,
  resolveManuscriptDrop,
  type ManuscriptResolvedDrop,
} from "./manuscript-tree-placement";
import {
  MANUSCRIPT_TREE_ROW_HEIGHT,
  ManuscriptTreeRow,
  ManuscriptTreeRowContent,
} from "./ManuscriptTreeRow";

const INSERT_INDICATOR_HEIGHT = 3;
const AUTO_SCROLL_EDGE = 52;
const AUTO_SCROLL_STEP = 16;

type ManuscriptTreeListProps = {
  outline: ManuscriptOutline;
  onOpenChapter: (nodeId: string) => void;
  onRename: (node: ManuscriptNode) => void;
  onDelete: (node: ManuscriptNode) => void;
  onMove: (sourceId: string, parentId: string, index?: number) => void;
};

export function ManuscriptTreeList({
  outline,
  onOpenChapter,
  onRename,
  onDelete,
  onMove,
}: ManuscriptTreeListProps) {
  const [collapsedIds, setCollapsedIds] = useState<Record<string, true>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drop, setDrop] = useState<ManuscriptResolvedDrop | null>(null);
  const rows = flattenVisibleManuscriptRows(outline, collapsedIds);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const listRef = useRef<ComponentRef<typeof View>>(null);
  const closeOpenSwipeRef = useRef<(() => void) | null>(null);
  const draggingRef = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const fingerYRef = useRef(0);
  const scrollYRef = useRef(0);
  const maxScrollRef = useRef(0);
  const listFrameRef = useRef({ pageY: 0, height: 0 });
  const dropRef = useRef<ManuscriptResolvedDrop | null>(null);
  const autoScrollRaf = useRef<number | null>(null);
  const latestRef = useRef({ outline, rows, onMove });
  latestRef.current = { outline, rows, onMove };
  const overlayY = useSharedValue(0);
  const overlayVisible = useSharedValue(0);
  const draggingRow = draggingId === null ? undefined : rows.find((row) => row.id === draggingId);
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayVisible.value,
    transform: [{ translateY: overlayY.value }],
  }));

  const measureList = () => {
    listRef.current?.measureInWindow((_x, y, _width, height) => {
      listFrameRef.current = { pageY: y, height };
    });
  };

  const applyDrop = (absoluteY: number) => {
    const { outline: currentOutline, rows: currentRows } = latestRef.current;
    const sourceId = draggingIdRef.current;
    const source = sourceId === null ? undefined : currentOutline.nodes[sourceId];
    if (sourceId === null || source === undefined) return;
    const pointerContentY = scrollYRef.current + absoluteY - listFrameRef.current.pageY;
    const next = resolveManuscriptDrop({
      outline: currentOutline,
      rows: currentRows,
      sourceId,
      sourceType: source.type,
      pointerContentY,
      rowHeight: MANUSCRIPT_TREE_ROW_HEIGHT,
    });
    if (dropKey(next) === dropKey(dropRef.current)) return;
    dropRef.current = next;
    setDrop(next);
  };

  const stopAutoScroll = () => {
    if (autoScrollRaf.current !== null) {
      cancelAnimationFrame(autoScrollRaf.current);
      autoScrollRaf.current = null;
    }
  };

  const startAutoScroll = () => {
    stopAutoScroll();
    const loop = () => {
      if (!draggingRef.current) return;
      const frame = listFrameRef.current;
      const y = fingerYRef.current;
      let next = scrollYRef.current;
      if (y < frame.pageY + AUTO_SCROLL_EDGE) next = Math.max(0, next - AUTO_SCROLL_STEP);
      else if (y > frame.pageY + frame.height - AUTO_SCROLL_EDGE) {
        next = Math.min(maxScrollRef.current, next + AUTO_SCROLL_STEP);
      }
      if (next !== scrollYRef.current) {
        scrollYRef.current = next;
        scrollRef.current?.scrollTo({ y: next, animated: false });
      }
      applyDrop(y);
      autoScrollRaf.current = requestAnimationFrame(loop);
    };
    autoScrollRaf.current = requestAnimationFrame(loop);
  };

  const handleDragActivate = (sourceId: string, absoluteY: number) => {
    closeOpenSwipeRef.current?.();
    closeOpenSwipeRef.current = null;
    draggingRef.current = true;
    draggingIdRef.current = sourceId;
    fingerYRef.current = absoluteY;
    dropRef.current = null;
    setDraggingId(sourceId);
    setDrop(null);
    overlayY.value = absoluteY - listFrameRef.current.pageY - MANUSCRIPT_TREE_ROW_HEIGHT / 2;
    overlayVisible.value = 1;
    measureList();
    startAutoScroll();
  };

  const handleDragUpdate = (absoluteY: number) => {
    fingerYRef.current = absoluteY;
    overlayY.value = absoluteY - listFrameRef.current.pageY - MANUSCRIPT_TREE_ROW_HEIGHT / 2;
    applyDrop(absoluteY);
  };

  const handleDragEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    stopAutoScroll();
    overlayVisible.value = 0;
    const resolved = dropRef.current;
    const sourceId = draggingIdRef.current;
    draggingIdRef.current = null;
    dropRef.current = null;
    setDraggingId(null);
    setDrop(null);
    if (sourceId === null || resolved === null) return;
    const move = latestRef.current.onMove;
    if (resolved.target.kind === "into") {
      move(sourceId, resolved.target.parentId);
      return;
    }
    move(sourceId, resolved.target.parentId, resolved.target.index);
  };

  if (rows.length === 0) {
    return <Text style={styles.emptyText}>空 manuscript。使用上方按钮创建文件夹或章节。</Text>;
  }

  return (
    <View ref={listRef} style={styles.list} onLayout={measureList}>
      <ScrollView
        ref={scrollRef}
        scrollEnabled={draggingId === null}
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        onContentSizeChange={(_width, height) => {
          maxScrollRef.current = Math.max(0, height - listFrameRef.current.height);
        }}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
      >
        <View>
          {rows.map((row) => {
            const node = outline.nodes[row.id];
            if (node === undefined) return null;
            return (
              <ManuscriptTreeRow
                key={row.id}
                row={row}
                dimmed={draggingId === row.id}
                highlighted={drop?.preview.kind === "into" && drop.preview.folderId === row.id}
                swipeEnabled={draggingId === null}
                dragEnabled={draggingId === null || draggingId === row.id}
                onPress={() => {
                  if (row.type === "folder") {
                    setCollapsedIds((current) => {
                      if (current[row.id] === true) {
                        const next = { ...current };
                        delete next[row.id];
                        return next;
                      }
                      return { ...current, [row.id]: true };
                    });
                    return;
                  }
                  onOpenChapter(row.id);
                }}
                onRename={() => {
                  onRename(node);
                }}
                onDelete={() => {
                  onDelete(node);
                }}
                onDragActivate={(absoluteY) => {
                  handleDragActivate(row.id, absoluteY);
                }}
                onDragUpdate={handleDragUpdate}
                onDragEnd={handleDragEnd}
                onSwipeOpen={(close) => {
                  if (closeOpenSwipeRef.current !== close) {
                    closeOpenSwipeRef.current?.();
                  }
                  closeOpenSwipeRef.current = close;
                }}
              />
            );
          })}
          {drop?.preview.kind === "insert" ? (
            <View
              pointerEvents="none"
              style={[
                styles.indicator,
                {
                  top:
                    drop.preview.visualIndex * MANUSCRIPT_TREE_ROW_HEIGHT -
                    INSERT_INDICATOR_HEIGHT / 2,
                  left: space[3] + drop.preview.depth * space[4],
                },
              ]}
            />
          ) : null}
        </View>
      </ScrollView>
      {draggingRow !== undefined ? (
        <Animated.View pointerEvents="none" style={[styles.ghost, overlayStyle]}>
          <ManuscriptTreeRowContent
            title={draggingRow.title}
            type={draggingRow.type}
            depth={draggingRow.depth}
            expanded={draggingRow.expanded}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    overflow: "hidden",
  },
  content: {
    paddingBottom: space[8],
  },
  emptyText: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    textAlign: "center",
    padding: space[6],
  },
  indicator: {
    position: "absolute",
    right: space[3],
    height: INSERT_INDICATOR_HEIGHT,
    borderRadius: INSERT_INDICATOR_HEIGHT,
    backgroundColor: color.accent,
  },
  ghost: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    elevation: 4,
    shadowColor: color.crust,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
