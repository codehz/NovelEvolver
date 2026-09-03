import { StyleSheet } from "react-native";
import { Easing } from "react-native-reanimated";

import { color, fontFamily, fontSize, radius, space, wash } from "../theme";

export const OVERLAY_TIMING = {
  duration: 220,
  easing: Easing.bezier(0.33, 1, 0.68, 1),
};

export const overlayStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: wash.backdrop,
  },
  frame: {
    flex: 1,
    justifyContent: "center",
    padding: space[6],
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: color.border,
    padding: space[4],
    gap: space[3],
  },
  title: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  message: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.field,
    borderRadius: radius.control,
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  menu: {
    gap: space[2],
  },
  menuItem: {
    borderRadius: radius.control,
    backgroundColor: color.field,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
  menuItemPressed: {
    backgroundColor: wash.row,
  },
  menuItemLabel: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  menuItemDangerLabel: {
    color: color.error,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: space[2],
  },
  secondary: {
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  secondaryLabel: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  primary: {
    borderRadius: radius.control,
    backgroundColor: wash.accentSoft,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  primaryLabel: {
    color: color.accent,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  danger: {
    borderRadius: radius.control,
    backgroundColor: wash.dangerSoft,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  dangerLabel: {
    color: color.error,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  disabledLabel: {
    opacity: 0.5,
  },
});
