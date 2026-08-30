import { shortenHomePath } from "@novelevolver/domain/path-display";
import type { ProjectMetadata } from "@novelevolver/domain/project";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

const sampleProject: ProjectMetadata = {
  id: 1,
  path: "/home/reader/Projects/demo-novel",
  lastOpenedAt: Date.now(),
  displayPath: shortenHomePath("/home/reader/Projects/demo-novel", "/home/reader"),
  displayName: "Demo Novel",
};

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NovelEvolver</Text>
      <Text style={styles.subtitle}>Mobile scaffold</Text>
      <Text style={styles.meta}>{sampleProject.displayName}</Text>
      <Text style={styles.meta}>{sampleProject.displayPath}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1e2e",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  title: {
    color: "#cdd6f4",
    fontSize: 24,
    fontWeight: "600",
  },
  subtitle: {
    color: "#a6adc8",
    fontSize: 16,
  },
  meta: {
    color: "#bac2de",
    fontSize: 14,
    textAlign: "center",
  },
});
