import type { WorktreeDomain } from "@novelevolver/domain/worktree";
import { StyleSheet } from "react-native";

import { color, radius, space } from "../../../shared/theme";
import { DropdownSelect } from "../../../shared/ui/DropdownSelect";

export type ExplorerDomain = WorktreeDomain | "changes" | "history";

const OPTIONS = [
  { key: "manuscript", label: "正文" },
  { key: "resource", label: "资源库" },
  { key: "changes", label: "更改" },
  { key: "history", label: "历史" },
] as const;

export type ExplorerDomainSelectProps = {
  value: ExplorerDomain;
  onChange: (value: ExplorerDomain) => void;
};

export function ExplorerDomainSelect({ value, onChange }: ExplorerDomainSelectProps) {
  return (
    <DropdownSelect
      value={value}
      options={OPTIONS}
      onChange={(next) => onChange(next as ExplorerDomain)}
      accessibilityLabel="切换工作区"
      style={styles.trigger}
    />
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexShrink: 0,
    minWidth: 76,
    minHeight: 32,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.control,
    backgroundColor: color.field,
  },
});
