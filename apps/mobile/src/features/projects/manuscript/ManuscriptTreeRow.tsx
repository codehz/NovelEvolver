import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Swipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import IconBook from "~icons/codicon/book";
import IconEdit from "~icons/codicon/edit";
import IconFolder from "~icons/codicon/folder";
import IconFolderOpened from "~icons/codicon/folder-opened";
import IconTrash from "~icons/codicon/trash";

import { color, fontFamily, fontSize, space } from "../../../shared/theme";
import type { ManuscriptVisibleRow } from "./manuscript-tree-flatten";

export const MANUSCRIPT_TREE_ROW_HEIGHT = 48;
const ACTION_WIDTH = 72;

type ManuscriptTreeRowContentProps = {
  title: string;
  type: ManuscriptVisibleRow["type"];
  depth: number;
  expanded: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
};

export function ManuscriptTreeRowContent({
  title,
  type,
  depth,
  expanded,
  dimmed = false,
  highlighted = false,
}: ManuscriptTreeRowContentProps) {
  const Icon = type === "folder" ? (expanded ? IconFolderOpened : IconFolder) : IconBook;
  const iconColor = type === "folder" ? color.accent : color.info;
  return (
    <View
      style={[
        styles.row,
        { paddingLeft: space[3] + depth * space[4] },
        highlighted && styles.highlighted,
        dimmed && styles.dimmed,
      ]}
    >
      <Icon width={18} height={18} color={iconColor} />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

type ManuscriptTreeRowProps = {
  row: ManuscriptVisibleRow;
  dimmed: boolean;
  highlighted: boolean;
  swipeEnabled: boolean;
  dragEnabled: boolean;
  onPress: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDragActivate: (absoluteY: number) => void;
  onDragUpdate: (absoluteY: number) => void;
  onDragEnd: () => void;
  onSwipeOpen: (close: () => void) => void;
};

export function ManuscriptTreeRow({
  row,
  dimmed,
  highlighted,
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
  const pan = usePanGesture({
    runOnJS: true,
    enabled: dragEnabled,
    activateAfterLongPress: 400,
    failOffsetX: [-20, 20],
    maxPointers: 1,
    onActivate: (event) => {
      suppressPressRef.current = true;
      swipeableRef.current?.close();
      onDragActivate(event.absoluteY);
    },
    onUpdate: (event) => {
      onDragUpdate(event.absoluteY);
    },
    onFinalize: () => {
      onDragEnd();
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
      renderRightActions={(_progress, _translation, methods) => (
        <View style={styles.actions}>
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
        </View>
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
          <ManuscriptTreeRowContent
            title={row.title}
            type={row.type}
            depth={row.depth}
            expanded={row.expanded}
            dimmed={dimmed}
            highlighted={highlighted}
          />
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
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingRight: space[3],
    backgroundColor: color.background,
  },
  highlighted: {
    backgroundColor: color.field,
  },
  dimmed: {
    opacity: 0.4,
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
