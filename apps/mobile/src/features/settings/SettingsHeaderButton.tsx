import type { ComponentRef, ComponentType, Ref } from "react";
import { Pressable, Text, type GestureResponderEvent } from "react-native";
import type { SvgProps } from "react-native-svg";

import { color } from "../../shared/theme";
import { settingsStyles } from "./settings-chrome";

type SettingsHeaderButtonProps = {
  ref?: Ref<ComponentRef<typeof Pressable>>;
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  Icon?: ComponentType<SvgProps>;
  disabled?: boolean;
};

export function SettingsHeaderButton({
  ref,
  label,
  onPress,
  Icon,
  disabled = false,
}: SettingsHeaderButtonProps) {
  return (
    <Pressable
      ref={ref}
      collapsable={false}
      onPress={onPress}
      disabled={disabled}
      style={[
        Icon ? settingsStyles.headerIconAction : settingsStyles.headerAction,
        disabled && settingsStyles.headerActionDisabled,
      ]}
      hitSlop={8}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {Icon ? (
        <Icon width={22} height={22} color={disabled ? color.muted : color.accent} />
      ) : (
        <Text
          style={[
            settingsStyles.headerActionLabel,
            disabled && settingsStyles.headerActionLabelDisabled,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
