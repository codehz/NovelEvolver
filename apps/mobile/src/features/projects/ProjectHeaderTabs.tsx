import { useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { color, fontFamily, fontSize, radius, space, wash } from "../../shared/theme";
import { PROJECT_PAGES, type ProjectPage } from "./project-pager-model";

type ProjectHeaderTabsProps = {
  activePage: ProjectPage;
  progress: SharedValue<number>;
  onSelectPage: (page: ProjectPage) => void;
};

type TabMeasurement = { x: number; width: number };

const labels: Record<ProjectPage, string> = {
  Explorer: "项目",
  Editor: "编辑器",
  AI: "AI",
};

type ProjectHeaderTabProps = {
  index: number;
  label: string;
  page: ProjectPage;
  activePage: ProjectPage;
  progress: SharedValue<number>;
  onLayout: (event: LayoutChangeEvent) => void;
  onSelectPage: (page: ProjectPage) => void;
};

function ProjectHeaderTab({
  index,
  label,
  page,
  activePage,
  progress,
  onLayout,
  onSelectPage,
}: ProjectHeaderTabProps) {
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.min(1, Math.abs(progress.value - index)),
      [0, 1],
      [color.accent, color.muted],
    ),
  }));
  const selected = page === activePage;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onLayout={onLayout}
      onPress={() => {
        onSelectPage(page);
      }}
      style={styles.tab}
    >
      <Animated.Text style={[styles.label, labelStyle]}>{label}</Animated.Text>
    </Pressable>
  );
}

export function ProjectHeaderTabs({ activePage, progress, onSelectPage }: ProjectHeaderTabsProps) {
  const [measurements, setMeasurements] = useState<Array<TabMeasurement | undefined>>([]);
  const indicatorStyle = useAnimatedStyle(() => {
    const explorer = measurements[0];
    const editor = measurements[1];
    const ai = measurements[2];
    if (explorer === undefined || editor === undefined || ai === undefined) {
      return { opacity: 0, transform: [{ translateX: 0 }], width: 0 };
    }
    return {
      opacity: 1,
      transform: [
        {
          translateX: interpolate(progress.value, [0, 1, 2], [explorer.x, editor.x, ai.x]),
        },
      ],
      width: interpolate(progress.value, [0, 1, 2], [explorer.width, editor.width, ai.width]),
    };
  });

  const recordMeasurement = (index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setMeasurements((current) => {
      const existing = current[index];
      if (existing?.x === x && existing.width === width) return current;
      const next = [...current];
      next[index] = { x, width };
      return next;
    });
  };

  return (
    <View style={styles.root} accessibilityRole="tablist">
      <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
      {PROJECT_PAGES.map((page, index) => (
        <ProjectHeaderTab
          key={page}
          index={index}
          label={labels[page]}
          page={page}
          activePage={activePage}
          progress={progress}
          onLayout={(event) => {
            recordMeasurement(index, event);
          }}
          onSelectPage={onSelectPage}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: 2,
    backgroundColor: color.surface,
  },
  indicator: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: 0,
    borderRadius: radius.control,
    backgroundColor: wash.accentSoft,
  },
  tab: {
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: space[2],
    borderRadius: radius.control,
  },
  label: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
});
