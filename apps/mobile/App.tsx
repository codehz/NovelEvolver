import "./global.css";
import { shortenHomePath } from "@novelevolver/domain/path-display";
import type { ProjectMetadata } from "@novelevolver/domain/project";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";

const sampleProject: ProjectMetadata = {
  id: 1,
  path: "/home/reader/Projects/demo-novel",
  lastOpenedAt: Date.now(),
  displayPath: shortenHomePath("/home/reader/Projects/demo-novel", "/home/reader"),
  displayName: "Demo Novel",
};

export default function App() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-app-background p-6">
      <Text className="text-2xl font-semibold text-app-foreground">NovelEvolver</Text>
      <Text className="text-base text-app-muted">Mobile scaffold</Text>
      <Text className="text-center text-sm text-ctp-subtext1">{sampleProject.displayName}</Text>
      <Text className="text-center text-sm text-ctp-subtext1">{sampleProject.displayPath}</Text>
      <StatusBar style="light" />
    </View>
  );
}
