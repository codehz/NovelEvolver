import { Text, View } from "react-native";

import { settingsStyles } from "./settings-chrome";

export function SettingsDetailPlaceholder() {
  return (
    <View style={settingsStyles.detailPlaceholder}>
      <Text style={settingsStyles.detailPlaceholderTitle}>选择一个设置项目</Text>
      <Text style={settingsStyles.detailPlaceholderHint}>详细内容将在这里显示</Text>
    </View>
  );
}
