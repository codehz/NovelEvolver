import { BottomSheet } from "@swmansion/react-native-bottom-sheet";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, fontFamily, fontSize, radius, space, wash } from "../../../shared/theme";

type AiPickerSheetProps = {
  title: string;
  visible: boolean;
  onDismiss: () => void;
  children: ReactNode;
};

const CLOSED_INDEX = 0;
const OPEN_INDEX = 1;

export function AiPickerSheet({ title, visible, onDismiss, children }: AiPickerSheetProps) {
  return (
    <>
      {visible ? (
        <Pressable accessibilityLabel="关闭选择器" style={styles.backdrop} onPress={onDismiss} />
      ) : null}
      <BottomSheet
        index={visible ? OPEN_INDEX : CLOSED_INDEX}
        detents={[0, "content"]}
        animateIn
        extendUnderStatusBar={false}
        surface={<View style={[StyleSheet.absoluteFill, styles.surface]} />}
        onIndexChange={(index) => {
          if (index === CLOSED_INDEX) {
            onDismiss();
          }
        }}
      >
        <View style={styles.content}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: wash.backdrop,
  },
  surface: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderColor: color.border,
  },
  content: {
    paddingBottom: space[4],
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginTop: space[2],
    marginBottom: space[1],
    borderRadius: radius.pill,
    backgroundColor: color.overlayMuted,
  },
  title: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    fontWeight: "600",
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
});
