import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ProjectTabParamList } from "../../app/navigation-types";
import { color, fontFamily, fontSize, radius, space, wash } from "../../shared/theme";

type ProjectTab = keyof ProjectTabParamList;

type ProjectHeaderTabsProps = {
  activeTab: ProjectTab;
  onSelectTab: (tab: ProjectTab) => void;
};

const tabs: { key: ProjectTab; label: string }[] = [
  { key: "Explorer", label: "项目" },
  { key: "Editor", label: "编辑器" },
  { key: "AI", label: "AI" },
];

export function ProjectHeaderTabs({ activeTab, onSelectTab }: ProjectHeaderTabsProps) {
  return (
    <View style={styles.root} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              onSelectTab(tab.key);
            }}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    padding: 2,
    backgroundColor: color.surface,
  },
  tab: {
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: space[2],
    borderRadius: radius.control,
  },
  tabSelected: {
    backgroundColor: wash.accentSoft,
  },
  label: {
    color: color.muted,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  labelSelected: {
    color: color.accent,
  },
});
