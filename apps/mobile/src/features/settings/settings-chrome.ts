import { StyleSheet } from "react-native";

import { color, fontFamily, fontSize, radius, space, wash } from "../../shared/theme";

export const WIDE_SETTINGS_BREAKPOINT = 768;
export const SETTINGS_RAIL_WIDTH = 280;

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
  /** JS Header has no native Toolbar inset; keep the 40dp back control off the screen edge. */
  headerLeftContainer: {
    paddingStart: space[4],
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
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  headerDangerLabel: {
    color: color.error,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  rail: {
    backgroundColor: color.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: color.border,
  },
  railItem: {
    paddingHorizontal: space[3],
    paddingVertical: space[3],
  },
  railItemSelected: {
    backgroundColor: wash.accentSoft,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryLabelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  categoryAction: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },

  railItemTitle: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
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
  detailPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    backgroundColor: color.background,
  },
  detailPlaceholderTitle: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
  },
  detailPlaceholderHint: {
    color: color.overlayMuted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
  },

  list: {
    flex: 1,
  },
  cardListContent: {
    padding: space[4],
    gap: space[3],
  },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.panel,
    backgroundColor: color.surface,
  },
  cardSelected: {
    borderColor: color.accent,
    backgroundColor: wash.accentSoft,
  },
  cardItem: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[1],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  cardHeaderTitle: {
    flex: 1,
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  cardHeaderMeta: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xxs,
  },
  cardRow: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[1],
  },
  cardRowSelected: {
    backgroundColor: wash.accentSoft,
  },
  cardAction: {
    alignItems: "center",
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  addCardButton: {
    alignItems: "center",
    marginTop: space[1],
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    borderWidth: 1,
    borderColor: color.accent,
    borderStyle: "dashed",
    borderRadius: radius.panel,
  },
  addCardLabel: {
    color: color.accent,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  row: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    gap: space[1],
  },
  rowSelected: {
    backgroundColor: wash.accentSoft,
  },
  rowTitle: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  rowMeta: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xxs,
  },
  technical: {
    color: color.muted,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xxs,
  },
  empty: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    padding: space[4],
  },
  error: {
    color: color.error,
    fontFamily: fontFamily.sans,
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
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
  },
  fieldHint: {
    color: color.overlayMuted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xxs,
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
  inputMono: {
    fontFamily: fontFamily.mono,
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
    fontFamily: fontFamily.sans,
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
    fontFamily: fontFamily.sans,
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
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xxs,
  },
});
