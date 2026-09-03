import type { WorktreeDomain } from "@novelevolver/domain/worktree";
import { useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import IconChevronDown from "~icons/codicon/chevron-down";

import { color, fontFamily, fontSize, radius, space } from "../../../shared/theme";
import { useOverlay } from "../../../shared/ui/OverlayHost";

export type ExplorerDomain = WorktreeDomain | "changes";

const OPTIONS: { value: ExplorerDomain; label: string }[] = [
  { value: "manuscript", label: "正文" },
  { value: "resource", label: "资源库" },
  { value: "changes", label: "更改" },
];

export type ExplorerDomainSelectProps = {
  value: ExplorerDomain;
  onChange: (value: ExplorerDomain) => void;
};

export function ExplorerDomainSelect({ value, onChange }: ExplorerDomainSelectProps) {
  const overlay = useOverlay();
  const triggerRef = useRef<ComponentRef<typeof Pressable>>(null);
  const [open, setOpen] = useState(false);
  const currentLabel = value === "resource" ? "资源库" : value === "changes" ? "更改" : "正文";
  const openMenu = () => {
    if (open) return;
    setOpen(true);
    const trigger = triggerRef.current;
    if (trigger === null) {
      setOpen(false);
      return;
    }
    trigger.measureInWindow((x, y, width, height) => {
      void overlay
        .menu({
          anchor: { x, y, width, height },
          selectedKey: value,
          options: OPTIONS.map((option) => ({ key: option.value, label: option.label })),
        })
        .then((nextValue) => {
          if (nextValue === "manuscript" || nextValue === "resource" || nextValue === "changes") {
            onChange(nextValue);
          }
        })
        .finally(() => {
          setOpen(false);
        });
    });
  };

  return (
    <Pressable
      ref={triggerRef}
      collapsable={false}
      style={styles.trigger}
      onPress={openMenu}
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
  );
}

const styles = StyleSheet.create({
  widthProbe: {
    height: 0,
    overflow: "hidden",
    opacity: 0,
  },
  trigger: {
    alignSelf: "flex-start",
    flexShrink: 0,
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
});
