import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { color, fontFamily, fontSize, radius, space } from "../../shared/theme";

type InputPromptProps = {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
};

export function InputPrompt({
  visible,
  title,
  placeholder,
  initialValue = "",
  confirmLabel,
  onCancel,
  onConfirm,
}: InputPromptProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => onCancel()}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            autoFocus
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={color.placeholder}
            style={styles.input}
            selectionColor={color.accent}
          />
          <View style={styles.actions}>
            <Pressable onPress={() => onCancel()} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>取消</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(value)} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00000099",
    padding: space[4],
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.panel,
    backgroundColor: color.surface,
    padding: space[4],
  },
  title: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    fontWeight: "600",
    marginBottom: space[3],
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.control,
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: color.field,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space[2], marginTop: space[4] },
  secondaryButton: {
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  secondaryText: { color: color.muted, fontFamily: fontFamily.sans, fontSize: fontSize.sm },
  primaryButton: {
    borderRadius: radius.control,
    backgroundColor: color.accent,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  primaryText: {
    color: color.primaryForeground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
