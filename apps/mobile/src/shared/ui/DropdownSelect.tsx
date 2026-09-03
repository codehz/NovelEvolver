import { useRef, useState, type ComponentRef } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import IconChevronDown from "~icons/codicon/chevron-down";

import { color, fontFamily, fontSize, radius, space } from "../theme";
import type { OverlayMenuOption } from "./OverlayHost";
import { useOverlay } from "./OverlayHost";

type DropdownSelectProps = {
  value: string;
  options: readonly OverlayMenuOption[];
  onChange: (value: string) => void;
  title?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function DropdownSelect({
  value,
  options,
  onChange,
  title,
  accessibilityLabel,
  style,
  labelStyle,
}: DropdownSelectProps) {
  const overlay = useOverlay();
  const triggerRef = useRef<ComponentRef<typeof Pressable>>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.key === value);

  const openMenu = () => {
    if (open) return;
    const trigger = triggerRef.current;
    if (trigger === null) return;
    setOpen(true);
    trigger.measureInWindow((x, y, width, height) => {
      void overlay
        .menu({
          anchor: { x, y, width, height },
          title,
          selectedKey: value,
          options: [...options],
          width: "wide",
        })
        .then((nextValue) => {
          if (nextValue !== null) onChange(nextValue);
        })
        .finally(() => setOpen(false));
    });
  };

  return (
    <Pressable
      ref={triggerRef}
      collapsable={false}
      style={[styles.trigger, style]}
      onPress={openMenu}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? selected?.label}
      accessibilityState={{ expanded: open }}
    >
      <View style={styles.labelWrap}>
        <Text style={[styles.label, labelStyle]} numberOfLines={1}>
          {selected?.label ?? "请选择"}
        </Text>
      </View>
      <IconChevronDown width={16} height={16} color={color.muted} />
    </Pressable>
  );
}

const styles = {
  trigger: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: space[2],
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.field,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    minHeight: 44,
  },
  labelWrap: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
  },
} satisfies Record<string, ViewStyle | TextStyle>;
