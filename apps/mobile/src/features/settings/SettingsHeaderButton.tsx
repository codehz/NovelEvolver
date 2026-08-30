import { Pressable, Text } from "react-native";

import { settingsStyles } from "./settings-chrome";

type SettingsHeaderButtonProps = {
  label: string;
  onPress: () => void;
};

export function SettingsHeaderButton({ label, onPress }: SettingsHeaderButtonProps) {
  return (
    <Pressable onPress={onPress} style={settingsStyles.headerAction} hitSlop={8}>
      <Text style={settingsStyles.headerActionLabel}>{label}</Text>
    </Pressable>
  );
}
