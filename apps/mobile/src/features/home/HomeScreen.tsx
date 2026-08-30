import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { color, fontSize, radius, space, wash } from "../../shared/theme";

export function HomeScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <Pressable
          style={styles.gear}
          onPress={() => {
            navigation.navigate("Settings");
          }}
          accessibilityLabel="打开设置"
        >
          <Text style={styles.gearLabel}>设置</Text>
        </Pressable>
      </View>
      <View style={styles.container}>
        <Text style={styles.title}>NovelEvolver</Text>
        <Text style={styles.subtitle}>本地运行 · 设置保存在本机</Text>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Catppuccin Mocha</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: color.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  topBarSpacer: {
    flex: 1,
  },
  gear: {
    borderRadius: radius.control,
    backgroundColor: wash.iconButton,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  gearLabel: {
    color: color.accent,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
  },
  title: {
    color: color.foreground,
    fontSize: fontSize.xl,
    fontWeight: "600",
  },
  subtitle: {
    color: color.muted,
    fontSize: fontSize.sm,
  },
  chip: {
    marginTop: space[2],
    borderRadius: radius.control,
    backgroundColor: wash.accentSoft,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  chipText: {
    color: color.accent,
    fontSize: fontSize.xxs,
    fontWeight: "600",
  },
});
