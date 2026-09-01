import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import IconBook from "~icons/codicon/book";
import IconEdit from "~icons/codicon/edit";
import IconFile from "~icons/codicon/file";
import IconFolder from "~icons/codicon/folder";
import IconFolderOpened from "~icons/codicon/folder-opened";
import IconTrash from "~icons/codicon/trash";

import { color, fontFamily, fontSize, radius, space, wash } from "../../../shared/theme";
import { OVERLAY_TIMING } from "../../../shared/ui/overlay-chrome";
import type { ExplorerVisibleRow } from "./explorer-tree-flatten";
import {
  explorerTreeActionCenterX,
  explorerTreeActionTooltipPlacement,
  type ExplorerTreeDragAction,
} from "./explorer-tree-gesture";

export const EXPLORER_TREE_ROW_HEIGHT = 48;
export const EXPLORER_TREE_PREVIEW_HEIGHT = 36;
export const EXPLORER_TREE_PREVIEW_ICON = 16;
export const EXPLORER_TREE_PREVIEW_ANCHOR_X = 1 + space[3] + EXPLORER_TREE_PREVIEW_ICON / 2;
export const EXPLORER_TREE_GHOST_OPACITY = 0.4;
export const EXPLORER_TREE_ACTION_WIDTH = 40;
export const EXPLORER_TREE_ACTION_GAP = space[1];
export const EXPLORER_TREE_ACTION_RIGHT_MARGIN = space[2];
export const EXPLORER_TREE_ACTION_AREA_WIDTH =
  EXPLORER_TREE_ACTION_WIDTH * 2 + EXPLORER_TREE_ACTION_GAP;
export const EXPLORER_TREE_ACTION_TOOLTIP_GAP = space[1];
export const EXPLORER_TREE_ACTION_TOOLTIP_WRAP_WIDTH = 72;
export const EXPLORER_TREE_ACTION_TOOLTIP_HEIGHT = space[1] * 2 + fontSize.xs + 2;

const ACTION_TOOLTIP_LABELS: Record<ExplorerTreeDragAction, string> = {
  rename: "改名",
  delete: "删除",
};

export type ExplorerDragPointer = {
  x: number;
  y: number;
  absoluteX: number;
  absoluteY: number;
};

function pointerFromEvent(event: {
  x: number;
  y: number;
  absoluteX: number;
  absoluteY: number;
}): ExplorerDragPointer {
  return {
    x: event.x,
    y: event.y,
    absoluteX: event.absoluteX,
    absoluteY: event.absoluteY,
  };
}

type ExplorerTreeRowContentProps = {
  title: string;
  type: ExplorerVisibleRow["type"];
  depth: number;
  expanded: boolean;
  selected?: boolean;
};

function rowIcon(type: ExplorerVisibleRow["type"], expanded: boolean) {
  if (type === "folder") return expanded ? IconFolderOpened : IconFolder;
  if (type === "file") return IconFile;
  return IconBook;
}

export function ExplorerTreeRowContent({
  title,
  type,
  depth,
  expanded,
  selected = false,
}: ExplorerTreeRowContentProps) {
  const Icon = rowIcon(type, expanded);
  const iconColor = type === "folder" ? color.accent : color.info;
  return (
    <View
      style={[
        styles.row,
        selected ? styles.rowSelected : undefined,
        {
          paddingLeft: space[3] + depth * space[4],
          paddingRight: space[3],
        },
      ]}
    >
      <Icon width={18} height={18} color={iconColor} />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

type ExplorerTreeDragPreviewProps = {
  title: string;
  type: ExplorerVisibleRow["type"];
  expanded: boolean;
};

export function ExplorerTreeDragPreview({ title, type, expanded }: ExplorerTreeDragPreviewProps) {
  const Icon = rowIcon(type, expanded);
  const iconColor = type === "folder" ? color.accent : color.info;
  return (
    <View pointerEvents="none" style={styles.preview}>
      <Icon
        width={EXPLORER_TREE_PREVIEW_ICON}
        height={EXPLORER_TREE_PREVIEW_ICON}
        color={iconColor}
      />
      <Text style={styles.previewTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

type ExplorerTreeRowActionsProps = {
  activeAction: ExplorerTreeDragAction | null;
  visible: boolean;
};

type ExplorerTreeActionTooltipProps = {
  action: ExplorerTreeDragAction | null;
  rowTop: number;
  listWidth: number;
};

export function ExplorerTreeActionTooltip({
  action,
  rowTop,
  listWidth,
}: ExplorerTreeActionTooltipProps) {
  const visible = action !== null && listWidth > 0;
  const lastRef = useRef({
    action: "rename" as ExplorerTreeDragAction,
    rowTop: 0,
    listWidth: 0,
  });
  if (visible) {
    lastRef.current = { action, rowTop, listWidth };
  }
  const shown = lastRef.current;
  const opacity = useSharedValue(0);
  opacity.value = withTiming(visible ? 1 : 0, OVERLAY_TIMING);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const centerX = explorerTreeActionCenterX({
    action: shown.action,
    listWidth: shown.listWidth,
    actionWidth: EXPLORER_TREE_ACTION_WIDTH,
    actionGap: EXPLORER_TREE_ACTION_GAP,
    actionRightMargin: EXPLORER_TREE_ACTION_RIGHT_MARGIN,
  });
  const placement = explorerTreeActionTooltipPlacement({
    rowTop: shown.rowTop,
    rowHeight: EXPLORER_TREE_ROW_HEIGHT,
    tooltipHeight: EXPLORER_TREE_ACTION_TOOLTIP_HEIGHT,
    gap: EXPLORER_TREE_ACTION_TOOLTIP_GAP,
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.tooltipWrap,
        fadeStyle,
        {
          left: centerX - EXPLORER_TREE_ACTION_TOOLTIP_WRAP_WIDTH / 2,
          top: placement.top,
        },
      ]}
    >
      <View style={styles.tooltipBubble}>
        <Text
          style={[
            styles.tooltipLabel,
            shown.action === "delete" ? styles.tooltipLabelDanger : undefined,
          ]}
        >
          {ACTION_TOOLTIP_LABELS[shown.action]}
        </Text>
      </View>
    </Animated.View>
  );
}

function ExplorerTreeRowActions({ activeAction, visible }: ExplorerTreeRowActionsProps) {
  const actionsOpacity = useSharedValue(0);
  const renameProgress = useSharedValue(0);
  const deleteProgress = useSharedValue(0);
  actionsOpacity.value = withTiming(visible ? 1 : 0, OVERLAY_TIMING);
  renameProgress.value = withTiming(activeAction === "rename" ? 1 : 0, OVERLAY_TIMING);
  deleteProgress.value = withTiming(activeAction === "delete" ? 1 : 0, OVERLAY_TIMING);
  const actionsStyle = useAnimatedStyle(() => ({ opacity: actionsOpacity.value }));
  const renameStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      renameProgress.value,
      [0, 1],
      [wash.accentSoft, color.accent],
    ),
  }));
  const deleteStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(deleteProgress.value, [0, 1], [wash.dangerSoft, color.error]),
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.actions, actionsStyle]}>
      <Animated.View style={[styles.action, renameStyle]}>
        <IconEdit
          width={18}
          height={18}
          color={activeAction === "rename" ? color.primaryForeground : color.accent}
        />
      </Animated.View>
      <Animated.View style={[styles.action, deleteStyle]}>
        <IconTrash
          width={18}
          height={18}
          color={activeAction === "delete" ? color.primaryForeground : color.error}
        />
      </Animated.View>
    </Animated.View>
  );
}

type ExplorerTreeRowProps = {
  row: ExplorerVisibleRow;
  selected: boolean;
  ghost: boolean;
  actionsVisible: boolean;
  activeAction: ExplorerTreeDragAction | null;
  dragEnabled: boolean;
  onPress: () => void;
  onDragActivate: (pointer: ExplorerDragPointer) => void;
  onDragUpdate: (pointer: ExplorerDragPointer) => void;
  onDragEnd: (pointer: ExplorerDragPointer) => void;
};

export function ExplorerTreeRow({
  row,
  selected,
  ghost,
  actionsVisible,
  activeAction,
  dragEnabled,
  onPress,
  onDragActivate,
  onDragUpdate,
  onDragEnd,
}: ExplorerTreeRowProps) {
  const suppressPressRef = useRef(false);
  const dragEnabledRef = useRef(dragEnabled);
  const onDragActivateRef = useRef(onDragActivate);
  const onDragUpdateRef = useRef(onDragUpdate);
  const onDragEndRef = useRef(onDragEnd);
  const lastPointerRef = useRef<ExplorerDragPointer>({
    x: 0,
    y: 0,
    absoluteX: 0,
    absoluteY: 0,
  });
  const ghostOpacity = useSharedValue(1);
  const ghostRef = useRef(ghost);
  if (ghost) ghostOpacity.value = withTiming(EXPLORER_TREE_GHOST_OPACITY, OVERLAY_TIMING);
  else if (ghostRef.current) ghostOpacity.value = withTiming(1, OVERLAY_TIMING);
  ghostRef.current = ghost;
  const ghostStyle = useAnimatedStyle(() => ({ opacity: ghostOpacity.value }));
  dragEnabledRef.current = dragEnabled;
  onDragActivateRef.current = onDragActivate;
  onDragUpdateRef.current = onDragUpdate;
  onDragEndRef.current = onDragEnd;
  const rememberPointer = (event: {
    x: number;
    y: number;
    absoluteX: number;
    absoluteY: number;
  }) => {
    lastPointerRef.current = pointerFromEvent(event);
  };
  const pan = usePanGesture({
    runOnJS: true,
    activateAfterLongPress: 400,
    maxPointers: 1,
    onTouchesDown: (event) => {
      const touch = event.changedTouches[0] ?? event.allTouches[0];
      if (touch !== undefined) rememberPointer(touch);
    },
    onTouchesMove: (event) => {
      const touch = event.changedTouches[0] ?? event.allTouches[0];
      if (touch === undefined) return;
      rememberPointer(touch);
      onDragUpdateRef.current(lastPointerRef.current);
    },
    onActivate: (event) => {
      if (!dragEnabledRef.current) return;
      suppressPressRef.current = true;
      if (event.absoluteX !== 0 || event.absoluteY !== 0) {
        rememberPointer(event);
      }
      onDragActivateRef.current(lastPointerRef.current);
    },
    onUpdate: (event) => {
      rememberPointer(event);
      onDragUpdateRef.current(lastPointerRef.current);
    },
    onFinalize: (event) => {
      if (event.absoluteX !== 0 || event.absoluteY !== 0) {
        rememberPointer(event);
      }
      onDragEndRef.current(lastPointerRef.current);
    },
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <Pressable
          style={styles.rowPressable}
          onPress={() => {
            if (suppressPressRef.current) {
              suppressPressRef.current = false;
              return;
            }
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={row.title}
          accessibilityState={{ selected }}
        >
          <Animated.View style={ghostStyle}>
            <ExplorerTreeRowContent
              title={row.title}
              type={row.type}
              depth={row.depth}
              expanded={row.expanded}
              selected={selected}
            />
          </Animated.View>
        </Pressable>
      </GestureDetector>
      <ExplorerTreeRowActions activeAction={activeAction} visible={actionsVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  rowPressable: {
    flex: 1,
  },
  row: {
    height: EXPLORER_TREE_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    backgroundColor: color.background,
  },
  rowSelected: {
    backgroundColor: wash.accentSoft,
  },
  preview: {
    height: EXPLORER_TREE_PREVIEW_HEIGHT,
    maxWidth: 280,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.panel,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    elevation: 6,
    shadowColor: color.crust,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  previewTitle: {
    flexShrink: 1,
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  title: {
    flex: 1,
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
  },
  actions: {
    position: "absolute",
    top: 0,
    right: EXPLORER_TREE_ACTION_RIGHT_MARGIN,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: EXPLORER_TREE_ACTION_GAP,
    width: EXPLORER_TREE_ACTION_AREA_WIDTH,
  },
  action: {
    width: EXPLORER_TREE_ACTION_WIDTH,
    height: EXPLORER_TREE_ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.panel,
  },
  tooltipWrap: {
    position: "absolute",
    width: EXPLORER_TREE_ACTION_TOOLTIP_WRAP_WIDTH,
    alignItems: "center",
    zIndex: 8,
    elevation: 12,
  },
  tooltipBubble: {
    backgroundColor: color.crust,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    elevation: 12,
    shadowColor: color.crust,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tooltipLabel: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  tooltipLabelDanger: {
    color: color.error,
  },
});
