import type { ComponentType } from "react";
import { Pressable, Text } from "react-native";
import type { SvgProps } from "react-native-svg";

import { color } from "../../shared/theme";
import { settingsStyles } from "./settings-chrome";

type SettingsHeaderButtonProps = {
  label: string;
  onPress: () => void;
  Icon?: ComponentType<SvgProps>;
};

export function SettingsHeaderButton({ label, onPress, Icon }: SettingsHeaderButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={Icon ? settingsStyles.headerIconAction : settingsStyles.headerAction}
      hitSlop={8}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {Icon ? (
        <Icon width={22} height={22} color={color.accent} />
      ) : (
        <Text style={settingsStyles.headerActionLabel}>{label}</Text>
      )}
    </Pressable>
  );
}
