import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
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
  manuscriptRowSlotY,
  sourceSubtreeRange,
  visualManuscriptRowSlots,
  type ManuscriptVisibleRow,
} from "../manuscript/manuscript-tree-flatten";
import {
  manuscriptTreeDragZoneKey,
  resolveManuscriptTreeDragZone,
  type ManuscriptTreeDragAction,
  type ManuscriptTreeDragZone,
} from "../manuscript/manuscript-tree-gesture";
import { dropKey, type ManuscriptResolvedDrop } from "../manuscript/manuscript-tree-placement";
import { ManuscriptDropIndicator } from "../manuscript/ManuscriptDropIndicator";
import {
  MANUSCRIPT_TREE_ACTION_GAP,
  MANUSCRIPT_TREE_ACTION_RIGHT_MARGIN,
  MANUSCRIPT_TREE_ACTION_WIDTH,
  MANUSCRIPT_TREE_PREVIEW_ANCHOR_X,
  MANUSCRIPT_TREE_PREVIEW_HEIGHT,
  MANUSCRIPT_TREE_ROW_HEIGHT,
  ManuscriptTreeActionTooltip,
  ManuscriptTreeDragPreview,
  ManuscriptTreeRow,
  type ManuscriptDragPointer,
} from "../manuscript/ManuscriptTreeRow";

const AUTO_SCROLL_EDGE = 52;
const AUTO_SCROLL_STEP = 16;
const ROW_ENTER_Y_OFFSET = 6;

type ExplorerTreeRowSlotProps = {
  y: number;
  enter: boolean;
  fade: boolean;
  pointerEvents: "auto" | "none";
  children: ReactNode;
};

function ExplorerTreeRowSlot({
  y,
  enter,
  fade,
  pointerEvents,
  children,
}: ExplorerTreeRowSlotProps) {
  const shift = useSharedValue(y);
  const opacity = useSharedValue(1);
  const mountedRef = useRef(false);
  const enteredRef = useRef(false);
  const fadedRef = useRef(false);
  const yRef = useRef(y);
  if (fade) {
    shift.value = y;
    if (!fadedRef.current) {
      opacity.value = 0;
      opacity.value = withTiming(1, OVERLAY_TIMING);
      fadedRef.current = true;
    }
  } else if (enter) {
    shift.value = y;
    if (!enteredRef.current) {
      opacity.value = 0;
      opacity.value = withTiming(1, OVERLAY_TIMING);
      if (!mountedRef.current) {
        shift.value = y - ROW_ENTER_Y_OFFSET;
        shift.value = withTiming(y, OVERLAY_TIMING);
      }
      enteredRef.current = true;
    }
  } else if (!mountedRef.current) {
    shift.value = y;
    opacity.value = 1;
  } else if (yRef.current !== y) {
    shift.value = withTiming(y, OVERLAY_TIMING);
  }
  if (!fade) fadedRef.current = false;
  if (!enter) enteredRef.current = false;
  mountedRef.current = true;
  yRef.current = y;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: shift.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View pointerEvents={pointerEvents} style={[styles.slot, style]}>
      {children}
    </Animated.View>
  );
}

export type ExplorerTreeListProps<TNode> = {
  flatten: (collapsedIds: Record<string, true>) => ManuscriptVisibleRow[];
  selectedNodeId: string | null;
  emptyText: string;
  getNode: (id: string) => TNode | undefined;
  onOpenLeaf: (nodeId: string) => void;
  onRename: (node: TNode) => void;
  onDelete: (node: TNode) => void;
  onMove: (sourceId: string, parentId: string, index?: number) => void;
  resolveDrop: (input: {
    rows: readonly ManuscriptVisibleRow[];
    sourceId: string;
    pointerContentY: number;
    rowHeight: number;
  }) => ManuscriptResolvedDrop | null;
};

export function ExplorerTreeList<TNode>({
  flatten,
  selectedNodeId,
  emptyText,
  getNode,
  onOpenLeaf,
  onRename,
  onDelete,
  onMove,
  resolveDrop,
}: ExplorerTreeListProps<TNode>) {
  const [collapsedIds, setCollapsedIds] = useState<Record<string, true>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [appearingIds, setAppearingIds] = useState<Record<string, true>>({});
  const [drop, setDrop] = useState<ManuscriptResolvedDrop | null>(null);
  const rows = flatten(collapsedIds);
  const { slots, slotCount } = visualManuscriptRowSlots(
    rows,
    draggingId,
    MANUSCRIPT_TREE_ROW_HEIGHT,
  );
  const seenKeysRef = useRef<Set<string> | null>(null);
  const enterIds = new Set<string>();
  if (seenKeysRef.current === null) {
    seenKeysRef.current = new Set(rows.map((row) => row.id));
  } else {
    for (const row of rows) {
      if (!seenKeysRef.current.has(row.id)) enterIds.add(row.id);
    }
    seenKeysRef.current = new Set(rows.map((row) => row.id));
  }
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const listRef = useRef<ComponentRef<typeof View>>(null);
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
  const listFrameRef = useRef({ pageX: 0, pageY: 0, width: 0, height: 0 });
  const dragZoneRef = useRef<ManuscriptTreeDragZone | null>(null);
  const dropRef = useRef<ManuscriptResolvedDrop | null>(null);
  const autoScrollRaf = useRef<number | null>(null);
  const previewGenRef = useRef(0);
  const appearingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ rows, getNode, onMove, onRename, onDelete, resolveDrop });
  latestRef.current = { rows, getNode, onMove, onRename, onDelete, resolveDrop };
  const [dragZone, setDragZone] = useState<ManuscriptTreeDragZone | null>(null);
  const [actionHover, setActionHover] = useState<{
    action: ManuscriptTreeDragAction;
    rowTop: number;
  } | null>(null);
  const actionHoverRef = useRef<{
    action: ManuscriptTreeDragAction;
    rowTop: number;
  } | null>(null);
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
  const contentHeight = slotCount * MANUSCRIPT_TREE_ROW_HEIGHT + space[8];
  maxScrollRef.current = Math.max(0, contentHeight - listFrameRef.current.height);
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
      index >= 0
        ? manuscriptRowSlotY(index, MANUSCRIPT_TREE_ROW_HEIGHT) - scrollYRef.current + localY
        : localY;
    return { x: localX, y };
  };
  const sourceRowTop = (sourceId: string) => {
    const index = latestRef.current.rows.findIndex((row) => row.id === sourceId);
    return index >= 0
      ? manuscriptRowSlotY(index, MANUSCRIPT_TREE_ROW_HEIGHT) - scrollYRef.current
      : 0;
  };
  const resolveDragZone = (sourceId: string, pointer: ManuscriptDragPointer) => {
    const point = pointerInViewport(sourceId, pointer);
    return resolveManuscriptTreeDragZone({
      x: point.x,
      y: point.y,
      rowTop: sourceRowTop(sourceId),
      rowHeight: MANUSCRIPT_TREE_ROW_HEIGHT,
      listWidth: listFrameRef.current.width,
      actionWidth: MANUSCRIPT_TREE_ACTION_WIDTH,
      actionGap: MANUSCRIPT_TREE_ACTION_GAP,
      actionRightMargin: MANUSCRIPT_TREE_ACTION_RIGHT_MARGIN,
    });
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
  const clearAppearingIds = () => {
    appearingClearRef.current = null;
    setAppearingIds({});
  };
  const cancelAppearingClear = () => {
    if (appearingClearRef.current === null) return;
    clearTimeout(appearingClearRef.current);
    appearingClearRef.current = null;
  };
  useEffect(
    () => () => {
      stopAutoScroll();
      if (appearingClearRef.current !== null) clearTimeout(appearingClearRef.current);
    },
    [],
  );

  const measureList = () => {
    listRef.current?.measureInWindow((x, y, width, height) => {
      listFrameRef.current = { pageX: x, pageY: y, width, height };
      maxScrollRef.current = Math.max(0, contentHeight - height);
      const sourceId = draggingIdRef.current;
      if (sourceId !== null) updateDragZone(sourceId, pointerRef.current);
    });
  };

  const applyDrop = (sourceId: string, pointer: ManuscriptDragPointer) => {
    const pointerContentY = pointerInViewport(sourceId, pointer).y + scrollYRef.current;
    const next = latestRef.current.resolveDrop({
      rows: latestRef.current.rows,
      sourceId,
      pointerContentY,
      rowHeight: MANUSCRIPT_TREE_ROW_HEIGHT,
    });
    if (dropKey(next) === dropKey(dropRef.current)) return;
    dropRef.current = next;
    setDrop(next);
  };

  const clearDrop = () => {
    if (dropRef.current === null) return;
    dropRef.current = null;
    setDrop(null);
  };

  const updateDragZone = (sourceId: string, pointer: ManuscriptDragPointer) => {
    const nextZone = resolveDragZone(sourceId, pointer);
    const previousZone = dragZoneRef.current;
    dragZoneRef.current = nextZone;
    if (manuscriptTreeDragZoneKey(previousZone) !== manuscriptTreeDragZoneKey(nextZone)) {
      setDragZone(nextZone);
      if (nextZone.kind === "outside") overlayProgress.value = withTiming(1, OVERLAY_TIMING);
      else overlayProgress.value = withTiming(0, OVERLAY_TIMING);
    }
    const nextHover =
      nextZone.kind === "action"
        ? { action: nextZone.action, rowTop: sourceRowTop(sourceId) }
        : null;
    const previousHover = actionHoverRef.current;
    if (
      previousHover?.action !== nextHover?.action ||
      previousHover?.rowTop !== nextHover?.rowTop
    ) {
      actionHoverRef.current = nextHover;
      setActionHover(nextHover);
    }
    if (nextZone.kind === "outside") applyDrop(sourceId, pointer);
    else clearDrop();
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
        updateDragZone(sourceId, pointerRef.current);
      }
      autoScrollRaf.current = requestAnimationFrame(loop);
    };
    autoScrollRaf.current = requestAnimationFrame(loop);
  };

  const handleDragActivate = (sourceId: string, pointer: ManuscriptDragPointer) => {
    draggingRef.current = true;
    draggingIdRef.current = sourceId;
    pointerRef.current = pointer;
    dragZoneRef.current = null;
    dropRef.current = null;
    const sourceRow = latestRef.current.rows.find((row) => row.id === sourceId);
    previewGenRef.current += 1;
    cancelAppearingClear();
    setAppearingIds({});
    setDraggingId(sourceId);
    setDragZone(null);
    setDrop(null);
    if (sourceRow !== undefined) {
      setPreview({
        title: sourceRow.title,
        type: sourceRow.type,
        expanded: sourceRow.expanded,
      });
    }
    placePreview(sourceId, pointer);
    updateDragZone(sourceId, pointer);
    listRef.current?.measureInWindow((x, y, width, height) => {
      listFrameRef.current = { pageX: x, pageY: y, width, height };
      if (draggingIdRef.current === sourceId) {
        placePreview(sourceId, pointerRef.current);
        updateDragZone(sourceId, pointerRef.current);
      }
    });
    startAutoScroll();
  };

  const handleDragUpdate = (pointer: ManuscriptDragPointer) => {
    const sourceId = draggingIdRef.current;
    if (sourceId === null) return;
    pointerRef.current = pointer;
    placePreview(sourceId, pointer);
    updateDragZone(sourceId, pointer);
  };

  const handleDragEnd = (pointer: ManuscriptDragPointer) => {
    if (!draggingRef.current) return;
    const sourceId = draggingIdRef.current;
    if (sourceId === null) return;
    pointerRef.current = pointer;
    updateDragZone(sourceId, pointer);
    const zone = dragZoneRef.current;
    const resolved = dropRef.current;
    draggingRef.current = false;
    stopAutoScroll();
    const generation = previewGenRef.current;
    overlayProgress.value = withTiming(0, OVERLAY_TIMING, (finished) => {
      if (finished) runOnJS(clearPreview)(generation);
    });
    draggingIdRef.current = null;
    dragZoneRef.current = null;
    dropRef.current = null;
    setDragZone(null);
    setDrop(null);
    actionHoverRef.current = null;
    setActionHover(null);
    const source = latestRef.current.getNode(sourceId);
    if (source !== undefined && zone?.kind === "action") {
      if (zone.action === "rename") latestRef.current.onRename(source);
      else latestRef.current.onDelete(source);
    } else if (zone?.kind === "outside") {
      if (resolved?.commit === true) {
        const range = sourceSubtreeRange(latestRef.current.rows, sourceId);
        const nextAppearing: Record<string, true> = {};
        if (range === null) {
          nextAppearing[sourceId] = true;
        } else {
          for (let index = range.start; index < range.start + range.count; index += 1) {
            const id = latestRef.current.rows[index]?.id;
            if (id !== undefined) nextAppearing[id] = true;
          }
        }
        setAppearingIds(nextAppearing);
        cancelAppearingClear();
        appearingClearRef.current = setTimeout(clearAppearingIds, OVERLAY_TIMING.duration);
        const move = latestRef.current.onMove;
        if (resolved.target.kind === "into") move(sourceId, resolved.target.parentId);
        else move(sourceId, resolved.target.parentId, resolved.target.index);
      }
    }
    setDraggingId(null);
  };

  if (rows.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View ref={listRef} collapsable={false} style={styles.list} onLayout={measureList}>
      <ScrollView
        ref={scrollRef}
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
          const sourceId = draggingIdRef.current;
          if (sourceId !== null) updateDragZone(sourceId, pointerRef.current);
        }}
        scrollEventThrottle={16}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.slots, { height: slotCount * MANUSCRIPT_TREE_ROW_HEIGHT }]}>
          {rows.map((row, index) => {
            const node = getNode(row.id);
            const slot = slots[index];
            if (node === undefined || slot === undefined) return null;
            const isDraggingRow = draggingId === row.id;
            const actionsVisible =
              isDraggingRow && dragZone !== null && dragZone.kind !== "outside";
            const activeAction = dragZone?.kind === "action" ? dragZone.action : null;
            return (
              <ExplorerTreeRowSlot
                key={row.id}
                y={slot.y}
                pointerEvents={draggingId !== null && draggingId !== row.id ? "none" : "auto"}
                enter={enterIds.has(row.id)}
                fade={appearingIds[row.id] === true}
              >
                <ManuscriptTreeRow
                  row={row}
                  selected={selectedNodeId === row.id}
                  ghost={slot.ghost}
                  actionsVisible={actionsVisible}
                  activeAction={isDraggingRow ? activeAction : null}
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
                    onOpenLeaf(row.id);
                  }}
                  onDragActivate={(pointer) => {
                    handleDragActivate(row.id, pointer);
                  }}
                  onDragUpdate={handleDragUpdate}
                  onDragEnd={handleDragEnd}
                />
              </ExplorerTreeRowSlot>
            );
          })}
          <ManuscriptDropIndicator preview={drop?.preview ?? null} />
        </View>
      </ScrollView>
      <View pointerEvents="none" style={styles.overlayLayer}>
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
        <ManuscriptTreeActionTooltip
          action={actionHover?.action ?? null}
          rowTop={actionHover?.rowTop ?? 0}
          listWidth={listFrameRef.current.width}
        />
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
  slots: {
    position: "relative",
  },
  slot: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: MANUSCRIPT_TREE_ROW_HEIGHT,
  },
  emptyText: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    textAlign: "center",
    padding: space[6],
  },
  previewWrap: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  overlayLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 8,
    elevation: 12,
  },
});
