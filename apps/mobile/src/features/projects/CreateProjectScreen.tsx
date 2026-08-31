import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import type { RootStackParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize, radius, space } from "../../shared/theme";
import { InputPrompt } from "./InputPrompt";
import { useProjectManager } from "./ProjectManagerProvider";

export function CreateProjectScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const manager = useProjectManager();
  const [promptVisible, setPromptVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  const create = async (value: string) => {
    const name = value.trim();
    if (name === "") return;
    setBusy(true);
    try {
      const opened = await manager.createEmpty(name);
      setPromptVisible(false);
      navigation.replace("Project", { projectId: opened.record.id });
    } catch (error) {
      Alert.alert("创建失败", error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <Text style={styles.title}>新建项目</Text>
        <Text style={styles.text}>为项目输入一个显示名称。</Text>
        <Pressable style={styles.cancel} onPress={() => navigation.goBack()} disabled={busy}>
          <Text style={styles.cancelText}>取消</Text>
        </Pressable>
      </View>
      <InputPrompt
        visible={promptVisible}
        title="新建项目"
        placeholder="项目名称"
        confirmLabel={busy ? "创建中…" : "创建"}
        onCancel={() => {
          setPromptVisible(false);
          navigation.goBack();
        }}
        onConfirm={(value) => {
          void create(value);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: color.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space[2] },
  title: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xl,
    fontWeight: "600",
  },
  text: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
  cancel: { marginTop: space[2], borderRadius: radius.control, padding: space[2] },
  cancelText: { color: color.accent, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
});
