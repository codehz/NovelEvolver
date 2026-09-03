import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { color, radius } from "../../shared/theme";

type SettingsToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TOGGLE_TIMING = {
  duration: 180,
  easing: Easing.out(Easing.cubic),
};

export function SettingsToggle({ value, onValueChange, disabled = false }: SettingsToggleProps) {
  const progress = useSharedValue(value ? 1 : 0);
  const disabledProgress = useSharedValue(disabled ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, TOGGLE_TIMING);
  }, [progress, value]);

  useEffect(() => {
    disabledProgress.value = withTiming(disabled ? 1 : 0, TOGGLE_TIMING);
  }, [disabled, disabledProgress]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - disabledProgress.value * 0.5,
  }));

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [color.field, color.accent]),
    borderColor: interpolateColor(progress.value, [0, 1], [color.border, color.accent]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [color.muted, color.primaryForeground],
    ),
    transform: [{ translateX: progress.value * 20 }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.root, rootStyle]}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 44,
    height: 32,
    justifyContent: "center",
  },
  track: {
    width: 44,
    height: 24,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  thumb: {
    width: 18,
    height: 18,
    marginStart: 2,
    borderRadius: radius.pill,
  },
});
