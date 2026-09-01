import type { WorktreeDomain } from "@novelevolver/domain/worktree";
import { Pressable, StyleSheet, Text, View } from "react-native";
import IconChevronDown from "~icons/codicon/chevron-down";

import { color, fontFamily, fontSize, radius, space, wash } from "../../../shared/theme";

const OPTIONS: { value: WorktreeDomain; label: string }[] = [
  { value: "manuscript", label: "正文" },
  { value: "resource", label: "资源库" },
];

export type ExplorerDomainSelectProps = {
  value: WorktreeDomain;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: WorktreeDomain) => void;
};

export function ExplorerDomainSelect({
  value,
  open,
  onOpenChange,
  onChange,
}: ExplorerDomainSelectProps) {
  const currentLabel = value === "resource" ? "资源库" : "正文";
  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.trigger}
        onPress={() => {
          onOpenChange(!open);
        }}
        accessibilityRole="button"
        accessibilityLabel={currentLabel}
        accessibilityState={{ expanded: open }}
      >
        <View>
          {OPTIONS.map((option) => (
            <Text
              key={option.value}
              style={[styles.triggerLabel, option.value === value ? undefined : styles.widthProbe]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          ))}
        </View>
        <IconChevronDown width={16} height={16} color={color.muted} />
      </Pressable>
      {open ? (
        <View style={styles.menu} accessibilityRole="menu">
          {OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                style={[styles.option, selected ? styles.optionSelected : undefined]}
                onPress={() => {
                  onChange(option.value);
                  onOpenChange(false);
                }}
                accessibilityRole="menuitem"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[styles.optionLabel, selected ? styles.optionLabelSelected : undefined]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    zIndex: 4,
    flexShrink: 0,
  },
  widthProbe: {
    height: 0,
    overflow: "hidden",
    opacity: 0,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.field,
    borderRadius: radius.control,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    minHeight: 32,
  },
  triggerLabel: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  menu: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: space[1],
    minWidth: "100%",
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.control,
    overflow: "hidden",
    zIndex: 8,
    elevation: 12,
  },
  option: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  optionSelected: {
    backgroundColor: wash.accentSoft,
  },
  optionLabel: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
  optionLabelSelected: {
    color: color.accent,
    fontWeight: "600",
  },
});
