import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import IconBook from "~icons/codicon/book";
import IconEdit from "~icons/codicon/edit";
import IconFolder from "~icons/codicon/folder";
import IconFolderOpened from "~icons/codicon/folder-opened";
import IconTrash from "~icons/codicon/trash";

import { color, fontFamily, fontSize, radius, space } from "../../../shared/theme";
import type { ManuscriptVisibleRow } from "./manuscript-tree-flatten";

export const MANUSCRIPT_TREE_ROW_HEIGHT = 48;
export const MANUSCRIPT_TREE_PREVIEW_HEIGHT = 36;
export const MANUSCRIPT_TREE_PREVIEW_ICON = 16;
export const MANUSCRIPT_TREE_PREVIEW_ANCHOR_X = 1 + space[3] + MANUSCRIPT_TREE_PREVIEW_ICON / 2;
const ACTION_WIDTH = 72;

export type ManuscriptDragPointer = {
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
}): ManuscriptDragPointer {
  return {
    x: event.x,
    y: event.y,
    absoluteX: event.absoluteX,
    absoluteY: event.absoluteY,
  };
}

type ManuscriptTreeRowContentProps = {
  title: string;
  type: ManuscriptVisibleRow["type"];
  depth: number;
  expanded: boolean;
};

export function ManuscriptTreeRowContent({
  title,
  type,
  depth,
  expanded,
}: ManuscriptTreeRowContentProps) {
  const Icon = type === "folder" ? (expanded ? IconFolderOpened : IconFolder) : IconBook;
  const iconColor = type === "folder" ? color.accent : color.info;
  return (
    <View style={[styles.row, { paddingLeft: space[3] + depth * space[4] }]}>
      <Icon width={18} height={18} color={iconColor} />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

type ManuscriptTreeDragPreviewProps = {
  title: string;
  type: ManuscriptVisibleRow["type"];
  expanded: boolean;
};

export function ManuscriptTreeDragPreview({
  title,
  type,
  expanded,
}: ManuscriptTreeDragPreviewProps) {
  const Icon = type === "folder" ? (expanded ? IconFolderOpened : IconFolder) : IconBook;
  const iconColor = type === "folder" ? color.accent : color.info;
  return (
    <View pointerEvents="none" style={styles.preview}>
      <Icon
        width={MANUSCRIPT_TREE_PREVIEW_ICON}
        height={MANUSCRIPT_TREE_PREVIEW_ICON}
        color={iconColor}
      />
      <Text style={styles.previewTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

type ManuscriptTreeRowActionsProps = {
  progress: SharedValue<number>;
  hidden: boolean;
  onRename: () => void;
  onDelete: () => void;
  methods: SwipeableMethods;
};

function ManuscriptTreeRowActions({
  progress,
  hidden,
  onRename,
  onDelete,
  methods,
}: ManuscriptTreeRowActionsProps) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value <= 0 ? 0 : 1,
  }));
  return (
    <Animated.View style={[styles.actions, hidden && styles.hidden, style]}>
      <Pressable
        style={styles.renameAction}
        onPress={() => {
          methods.close();
          onRename();
        }}
        accessibilityRole="button"
        accessibilityLabel="改名"
      >
        <IconEdit width={18} height={18} color={color.primaryForeground} />
        <Text style={styles.actionLabel}>改名</Text>
      </Pressable>
      <Pressable
        style={styles.deleteAction}
        onPress={() => {
          methods.close();
          onDelete();
        }}
        accessibilityRole="button"
        accessibilityLabel="删除"
      >
        <IconTrash width={18} height={18} color={color.primaryForeground} />
        <Text style={styles.actionLabel}>删除</Text>
      </Pressable>
    </Animated.View>
  );
}

type ManuscriptTreeRowProps = {
  row: ManuscriptVisibleRow;
  hidden: boolean;
  swipeEnabled: boolean;
  dragEnabled: boolean;
  onPress: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDragActivate: (pointer: ManuscriptDragPointer) => void;
  onDragUpdate: (pointer: ManuscriptDragPointer) => void;
  onDragEnd: () => void;
  onSwipeOpen: (close: () => void) => void;
};

export function ManuscriptTreeRow({
  row,
  hidden,
  swipeEnabled,
  dragEnabled,
  onPress,
  onRename,
  onDelete,
  onDragActivate,
  onDragUpdate,
  onDragEnd,
  onSwipeOpen,
}: ManuscriptTreeRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const swipeOpenRef = useRef(false);
  const suppressPressRef = useRef(false);
  const dragEnabledRef = useRef(dragEnabled);
  const onDragActivateRef = useRef(onDragActivate);
  const onDragUpdateRef = useRef(onDragUpdate);
  const onDragEndRef = useRef(onDragEnd);
  const lastPointerRef = useRef<ManuscriptDragPointer>({
    x: 0,
    y: 0,
    absoluteX: 0,
    absoluteY: 0,
  });
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
    failOffsetX: [-20, 20],
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
      swipeableRef.current?.close();
      if (event.absoluteX !== 0 || event.absoluteY !== 0) {
        rememberPointer(event);
      }
      onDragActivateRef.current(lastPointerRef.current);
    },
    onUpdate: (event) => {
      rememberPointer(event);
      onDragUpdateRef.current(lastPointerRef.current);
    },
    onFinalize: () => {
      onDragEndRef.current();
    },
  });

  return (
    <Swipeable
      ref={swipeableRef}
      enabled={swipeEnabled}
      overshootRight={false}
      overshootFriction={8}
      rightThreshold={40}
      onSwipeableOpen={() => {
        swipeOpenRef.current = true;
        onSwipeOpen(() => swipeableRef.current?.close());
      }}
      onSwipeableClose={() => {
        swipeOpenRef.current = false;
      }}
      renderRightActions={(progress, _translation, methods) => (
        <ManuscriptTreeRowActions
          progress={progress}
          hidden={hidden}
          methods={methods}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}
    >
      <GestureDetector gesture={pan}>
        <Pressable
          onPress={() => {
            if (suppressPressRef.current) {
              suppressPressRef.current = false;
              return;
            }
            if (swipeOpenRef.current) {
              swipeableRef.current?.close();
              return;
            }
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={row.title}
        >
          <View style={hidden ? styles.hidden : undefined}>
            <ManuscriptTreeRowContent
              title={row.title}
              type={row.type}
              depth={row.depth}
              expanded={row.expanded}
            />
          </View>
        </Pressable>
      </GestureDetector>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: MANUSCRIPT_TREE_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingRight: space[3],
    backgroundColor: color.background,
  },
  hidden: {
    opacity: 0,
  },
  preview: {
    height: MANUSCRIPT_TREE_PREVIEW_HEIGHT,
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
    flexDirection: "row",
    width: ACTION_WIDTH * 2,
  },
  renameAction: {
    width: ACTION_WIDTH,
    backgroundColor: color.accent,
    alignItems: "center",
    justifyContent: "center",
    gap: space[1],
  },
  deleteAction: {
    width: ACTION_WIDTH,
    backgroundColor: color.error,
    alignItems: "center",
    justifyContent: "center",
    gap: space[1],
  },
  actionLabel: {
    color: color.primaryForeground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
});
