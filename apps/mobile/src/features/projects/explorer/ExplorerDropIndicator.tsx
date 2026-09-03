import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { color, space, withAlpha } from "../../../shared/theme";
import { OVERLAY_TIMING } from "../../../shared/ui/overlay-chrome";
import type { ExplorerDropPreview } from "./explorer-tree-drop";
import { EXPLORER_TREE_ROW_HEIGHT } from "./ExplorerTreeRow";

export const EXPLORER_DROP_INDICATOR_HEIGHT = 3;

const INSERT_INSET = space[3];
const INSERT_COLOR = color.accent;
const HIGHLIGHT_COLOR = withAlpha(color.accent, 0.2);

type ExplorerDropIndicatorProps = {
  preview: ExplorerDropPreview | null;
};

type IndicatorGeom = {
  top: number;
  height: number;
  left: number;
  right: number;
  mode: number;
};

function previewGeom(preview: ExplorerDropPreview): IndicatorGeom {
  if (preview.kind === "insert") {
    return {
      top: preview.visualIndex * EXPLORER_TREE_ROW_HEIGHT - EXPLORER_DROP_INDICATOR_HEIGHT / 2,
      height: EXPLORER_DROP_INDICATOR_HEIGHT,
      left: INSERT_INSET + preview.depth * space[4],
      right: INSERT_INSET,
      mode: 0,
    };
  }
  return {
    top: preview.startIndex * EXPLORER_TREE_ROW_HEIGHT,
    height: (preview.endIndex - preview.startIndex + 1) * EXPLORER_TREE_ROW_HEIGHT,
    left: 0,
    right: 0,
    mode: 1,
  };
}

function sameGeom(a: IndicatorGeom | null, b: IndicatorGeom): boolean {
  return (
    a !== null &&
    a.top === b.top &&
    a.height === b.height &&
    a.left === b.left &&
    a.right === b.right &&
    a.mode === b.mode
  );
}

export function ExplorerDropIndicator({ preview }: ExplorerDropIndicatorProps) {
  const opacity = useSharedValue(0);
  const top = useSharedValue(0);
  const height = useSharedValue(EXPLORER_DROP_INDICATOR_HEIGHT);
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const mode = useSharedValue(0);
  const visibleRef = useRef(false);
  const geomRef = useRef<IndicatorGeom | null>(null);

  useEffect(() => {
    if (preview === null) {
      if (visibleRef.current) {
        opacity.value = withTiming(0, OVERLAY_TIMING);
        visibleRef.current = false;
        geomRef.current = null;
      }
      return;
    }

    const geom = previewGeom(preview);
    if (!visibleRef.current) {
      top.value = geom.top;
      height.value = geom.height;
      left.value = geom.left;
      right.value = geom.right;
      mode.value = geom.mode;
      opacity.value = withTiming(1, OVERLAY_TIMING);
      visibleRef.current = true;
    } else if (!sameGeom(geomRef.current, geom)) {
      top.value = withTiming(geom.top, OVERLAY_TIMING);
      height.value = withTiming(geom.height, OVERLAY_TIMING);
      left.value = withTiming(geom.left, OVERLAY_TIMING);
      right.value = withTiming(geom.right, OVERLAY_TIMING);
      mode.value = withTiming(geom.mode, OVERLAY_TIMING);
    }
    geomRef.current = geom;
  }, [height, left, mode, opacity, preview, right, top]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: top.value }],
    height: height.value,
    left: left.value,
    right: right.value,
    borderRadius: interpolate(mode.value, [0, 1], [EXPLORER_DROP_INDICATOR_HEIGHT / 2, 0]),
    backgroundColor: interpolateColor(mode.value, [0, 1], [INSERT_COLOR, HIGHLIGHT_COLOR]),
  }));

  return <Animated.View pointerEvents="none" style={[styles.indicator, style]} />;
}

const styles = StyleSheet.create({
  indicator: {
    position: "absolute",
    top: 0,
  },
});
