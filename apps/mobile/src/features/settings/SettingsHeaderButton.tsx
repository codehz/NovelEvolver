import type { ComponentType } from "react";
import { Pressable, Text } from "react-native";
import type { SvgProps } from "react-native-svg";

import { color } from "../../shared/theme";
import { settingsStyles } from "./settings-chrome";

type SettingsHeaderButtonProps = {
  label: string;
  onPress: () => void;
  Icon?: ComponentType<SvgProps>;
  disabled?: boolean;
};

export function SettingsHeaderButton({
  label,
  onPress,
  Icon,
  disabled = false,
}: SettingsHeaderButtonProps) {
  return (
    <Pressable
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
