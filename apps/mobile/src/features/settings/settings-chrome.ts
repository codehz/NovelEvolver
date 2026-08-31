import { StyleSheet } from "react-native";

import { color, fontSize, radius, space, wash } from "../../shared/theme";

export const WIDE_SETTINGS_BREAKPOINT = 768;
export const SETTINGS_RAIL_WIDTH = 220;

export const settingsStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.background,
  },
  headerBack: {
    marginVertical: 0,
    marginHorizontal: 0,
    marginStart: 0,
    marginEnd: space[4],
    width: 40,
    height: 40,
    paddingHorizontal: 0,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerAction: {
    borderRadius: radius.control,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  headerIconAction: {
    width: 32,
    height: 32,
    borderRadius: radius.control,
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionLabel: {
    color: color.accent,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  headerDangerLabel: {
    color: color.error,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  rail: {
    backgroundColor: color.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: color.border,
  },
  railLabel: {
    color: color.muted,
    fontSize: fontSize.xxs,
    fontWeight: "600",
    paddingHorizontal: space[3],
    paddingTop: space[3],
    paddingBottom: space[2],
  },
  railItem: {
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
  railItemSelected: {
    backgroundColor: wash.accentSoft,
  },
  railItemTitle: {
    color: color.foreground,
    fontSize: fontSize.sm,
  },
  railItemTitleSelected: {
    color: color.accent,
    fontWeight: "600",
  },
  detail: {
    flex: 1,
    minWidth: 0,
  },
  list: {
    flex: 1,
  },
  row: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    gap: space[1],
  },
  rowTitle: {
    color: color.foreground,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  rowMeta: {
    color: color.muted,
    fontSize: fontSize.xxs,
  },
  empty: {
    color: color.muted,
    fontSize: fontSize.sm,
    padding: space[4],
  },
  error: {
    color: color.error,
    fontSize: fontSize.xs,
    paddingHorizontal: space[4],
    paddingTop: space[2],
  },
  form: {
    padding: space[4],
    gap: space[3],
  },
  field: {
    gap: space[1],
  },
  fieldLabel: {
    color: color.muted,
    fontSize: fontSize.xs,
  },
  fieldHint: {
    color: color.overlayMuted,
    fontSize: fontSize.xxs,
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.field,
    borderRadius: radius.control,
    color: color.foreground,
    fontSize: fontSize.sm,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
  },
  chipSelected: {
    backgroundColor: wash.accentSoft,
    borderColor: color.accent,
  },
  chipLabel: {
    color: color.muted,
    fontSize: fontSize.xxs,
  },
  chipLabelSelected: {
    color: color.accent,
    fontWeight: "600",
  },
  option: {
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    backgroundColor: color.field,
  },
  optionSelected: {
    backgroundColor: wash.accentSoft,
  },
  optionLabel: {
    color: color.foreground,
    fontSize: fontSize.sm,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    backgroundColor: wash.mutedFill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  badgeLabel: {
    color: color.muted,
    fontSize: fontSize.xxs,
  },
});
