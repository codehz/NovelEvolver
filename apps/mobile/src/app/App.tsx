import { StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { color, fontSize, radius, space, wash } from "../shared/theme";

export function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>NovelEvolver</Text>
          <Text style={styles.subtitle}>React Native scaffold</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Catppuccin Mocha</Text>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: color.background,
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
