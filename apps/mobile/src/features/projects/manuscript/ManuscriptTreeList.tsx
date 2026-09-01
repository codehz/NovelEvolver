import type { ManuscriptNode, ManuscriptOutline } from "@novelevolver/domain/worktree";
import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { color, fontFamily, fontSize, space } from "../../../shared/theme";
import { OVERLAY_TIMING } from "../../../shared/ui/overlay-chrome";
import {
  flattenVisibleManuscriptRows,
  sourceSubtreeRange,
  type ManuscriptVisibleRow,
} from "./manuscript-tree-flatten";
import {
  dropKey,
  resolveManuscriptDrop,
  type ManuscriptResolvedDrop,
} from "./manuscript-tree-placement";
import {
  MANUSCRIPT_TREE_PREVIEW_ANCHOR_X,
  MANUSCRIPT_TREE_PREVIEW_HEIGHT,
  MANUSCRIPT_TREE_ROW_HEIGHT,
  ManuscriptTreeDragPreview,
  ManuscriptTreeRow,
  type ManuscriptDragPointer,
} from "./ManuscriptTreeRow";

const INSERT_INDICATOR_HEIGHT = 3;
const AUTO_SCROLL_EDGE = 52;
const AUTO_SCROLL_STEP = 16;

type ManuscriptTreeRowSlotProps = {
  translateY: number;
  animateShift: boolean;
  pointerEvents: "auto" | "none";
  appear: boolean;
  children: ReactNode;
};

function ManuscriptTreeRowSlot({
  translateY,
  animateShift,
  pointerEvents,
  appear,
  children,
}: ManuscriptTreeRowSlotProps) {
  const shift = useSharedValue(translateY);
  const opacity = useSharedValue(1);
  const appearedRef = useRef(false);
  shift.value = animateShift ? withTiming(translateY, OVERLAY_TIMING) : translateY;
  if (appear && !appearedRef.current) {
    opacity.value = 0;
    opacity.value = withTiming(1, OVERLAY_TIMING);
  }
  if (!appear) opacity.value = 1;
  appearedRef.current = appear;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: shift.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View pointerEvents={pointerEvents} style={style}>
      {children}
    </Animated.View>
  );
}

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
  const [appearingId, setAppearingId] = useState<string | null>(null);
  const [drop, setDrop] = useState<ManuscriptResolvedDrop | null>(null);
  const rows = flattenVisibleManuscriptRows(outline, collapsedIds);
  const dragRange = draggingId === null ? null : sourceSubtreeRange(rows, draggingId);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const listRef = useRef<ComponentRef<typeof View>>(null);
  const closeOpenSwipeRef = useRef<(() => void) | null>(null);
  const draggingRef = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const fingerYRef = useRef(0);
  const pointerRef = useRef<ManuscriptDragPointer>({
    x: 0,
    y: 0,
    absoluteX: 0,
    absoluteY: 0,
  });
  const scrollYRef = useRef(0);
  const maxScrollRef = useRef(0);
  const listFrameRef = useRef({ pageX: 0, pageY: 0, height: 0 });
  const dropRef = useRef<ManuscriptResolvedDrop | null>(null);
  const autoScrollRaf = useRef<number | null>(null);
  const previewGenRef = useRef(0);
  const latestRef = useRef({ outline, rows, onMove });
  latestRef.current = { outline, rows, onMove };
  const overlayY = useSharedValue(0);
  const overlayX = useSharedValue(0);
  const overlayProgress = useSharedValue(0);
  const [preview, setPreview] = useState<{
    title: string;
    type: ManuscriptVisibleRow["type"];
    expanded: boolean;
  } | null>(null);
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayProgress.value,
    left: overlayX.value - MANUSCRIPT_TREE_PREVIEW_ANCHOR_X,
    top: overlayY.value - MANUSCRIPT_TREE_PREVIEW_HEIGHT / 2,
  }));
  const overlayScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(overlayProgress.value, [0, 1], [1, 0.88]) }],
  }));
  const pointerInViewport = (sourceId: string, pointer: ManuscriptDragPointer) => {
    const frame = listFrameRef.current;
    if (pointer.absoluteY !== 0 || pointer.absoluteX !== 0) {
      return {
        x: pointer.absoluteX - frame.pageX,
        y: pointer.absoluteY - frame.pageY,
      };
    }
    const index = latestRef.current.rows.findIndex((row) => row.id === sourceId);
    const localY = Number.isFinite(pointer.y) ? pointer.y : MANUSCRIPT_TREE_ROW_HEIGHT / 2;
    const localX = Number.isFinite(pointer.x) ? pointer.x : space[4];
    const y =
      index >= 0 ? index * MANUSCRIPT_TREE_ROW_HEIGHT - scrollYRef.current + localY : localY;
    return { x: localX, y };
  };
  const placePreview = (sourceId: string, pointer: ManuscriptDragPointer) => {
    const point = pointerInViewport(sourceId, pointer);
    overlayX.value = point.x;
    overlayY.value = point.y;
    fingerYRef.current = frameFingerY(point.y);
  };
  const frameFingerY = (viewportY: number) => listFrameRef.current.pageY + viewportY;
  const clearPreview = (generation: number) => {
    if (previewGenRef.current === generation) setPreview(null);
  };

  const measureList = () => {
    listRef.current?.measureInWindow((x, y, _width, height) => {
      listFrameRef.current = { pageX: x, pageY: y, height };
    });
  };

  const applyDrop = (sourceId: string, pointer: ManuscriptDragPointer) => {
    const { outline: currentOutline, rows: currentRows } = latestRef.current;
    const source = currentOutline.nodes[sourceId];
    if (source === undefined) return;
    const pointerContentY = pointerInViewport(sourceId, pointer).y + scrollYRef.current;
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
      const sourceId = draggingIdRef.current;
      if (sourceId !== null) {
        placePreview(sourceId, pointerRef.current);
        applyDrop(sourceId, pointerRef.current);
      }
      autoScrollRaf.current = requestAnimationFrame(loop);
    };
    autoScrollRaf.current = requestAnimationFrame(loop);
  };

  const handleDragActivate = (sourceId: string, pointer: ManuscriptDragPointer) => {
    closeOpenSwipeRef.current?.();
    closeOpenSwipeRef.current = null;
    draggingRef.current = true;
    draggingIdRef.current = sourceId;
    pointerRef.current = pointer;
    dropRef.current = null;
    const sourceRow = latestRef.current.rows.find((row) => row.id === sourceId);
    previewGenRef.current += 1;
    setAppearingId(null);
    setDraggingId(sourceId);
    setDrop(null);
    if (sourceRow !== undefined) {
      setPreview({
        title: sourceRow.title,
        type: sourceRow.type,
        expanded: sourceRow.expanded,
      });
    }
    placePreview(sourceId, pointer);
    overlayProgress.value = withTiming(1, OVERLAY_TIMING);
    listRef.current?.measureInWindow((x, y, _width, height) => {
      listFrameRef.current = { pageX: x, pageY: y, height };
      if (draggingIdRef.current === sourceId) placePreview(sourceId, pointer);
    });
    startAutoScroll();
  };

  const handleDragUpdate = (pointer: ManuscriptDragPointer) => {
    const sourceId = draggingIdRef.current;
    if (sourceId === null) return;
    pointerRef.current = pointer;
    placePreview(sourceId, pointer);
    applyDrop(sourceId, pointer);
  };

  const handleDragEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    stopAutoScroll();
    const generation = previewGenRef.current;
    overlayProgress.value = withTiming(0, OVERLAY_TIMING, (finished) => {
      if (finished) runOnJS(clearPreview)(generation);
    });
    const resolved = dropRef.current;
    const sourceId = draggingIdRef.current;
    draggingIdRef.current = null;
    dropRef.current = null;
    setDrop(null);
    if (sourceId !== null && resolved?.commit === true) {
      setAppearingId(sourceId);
      const move = latestRef.current.onMove;
      if (resolved.target.kind === "into") move(sourceId, resolved.target.parentId);
      else move(sourceId, resolved.target.parentId, resolved.target.index);
    }
    setDraggingId(null);
  };

  if (rows.length === 0) {
    return <Text style={styles.emptyText}>空 manuscript。使用上方按钮创建文件夹或章节。</Text>;
  }

  return (
    <View ref={listRef} collapsable={false} style={styles.list} onLayout={measureList}>
      <ScrollView
        ref={scrollRef}
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
          {rows.map((row, index) => {
            const node = outline.nodes[row.id];
            if (node === undefined) return null;
            const inSourceSubtree =
              dragRange !== null &&
              index >= dragRange.start &&
              index < dragRange.start + dragRange.count;
            const translateY =
              dragRange !== null && index >= dragRange.start + dragRange.count
                ? -dragRange.count * MANUSCRIPT_TREE_ROW_HEIGHT
                : 0;
            return (
              <ManuscriptTreeRowSlot
                key={row.id}
                translateY={translateY}
                animateShift={appearingId === null}
                pointerEvents={draggingId !== null && draggingId !== row.id ? "none" : "auto"}
                appear={appearingId === row.id}
              >
                <ManuscriptTreeRow
                  row={row}
                  hidden={inSourceSubtree}
                  highlighted={drop?.preview.kind === "into" && drop.preview.folderId === row.id}
                  swipeEnabled={draggingId === null || draggingId === row.id}
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
                  onDragActivate={(pointer) => {
                    handleDragActivate(row.id, pointer);
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
              </ManuscriptTreeRowSlot>
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
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View pointerEvents="none" style={[styles.previewWrap, overlayStyle]}>
          {preview !== null ? (
            <Animated.View pointerEvents="none" style={overlayScaleStyle}>
              <ManuscriptTreeDragPreview
                title={preview.title}
                type={preview.type}
                expanded={preview.expanded}
              />
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
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
  previewWrap: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
