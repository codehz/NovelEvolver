import { Header } from "@react-navigation/elements";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import type { ProjectTabParamList } from "../../app/navigation-types";
import { color, space } from "../../shared/theme";
import { settingsStyles } from "../settings/settings-chrome";
import { SettingsHeaderBackButton } from "../settings/SettingsHeaderBackButton";
import { ProjectHeaderTabs } from "./ProjectHeaderTabs";

type ProjectTab = keyof ProjectTabParamList;

export type ProjectMediumHeaderNavigation = {
  activeTab: ProjectTab;
  onSelectTab: (tab: ProjectTab) => void;
  onBack: () => void;
};

type ProjectMediumHeaderProps = ProjectMediumHeaderNavigation & {
  context?: ReactNode;
  actions?: ReactNode;
};

export function ProjectMediumHeader({
  activeTab,
  onSelectTab,
  onBack,
  context,
  actions,
}: ProjectMediumHeaderProps) {
  return (
    <Header
      title=""
      headerTitle={() => (context ? <View style={styles.context}>{context}</View> : null)}
      headerTitleAlign="left"
      headerTintColor={color.accent}
      headerStyle={settingsStyles.header}
      headerShadowVisible={false}
      headerLeftContainerStyle={settingsStyles.headerLeftContainer}
      headerLeft={(props) => (
        <View style={styles.leading}>
          <SettingsHeaderBackButton {...props} onPress={onBack} />
          <ProjectHeaderTabs activeTab={activeTab} onSelectTab={onSelectTab} />
        </View>
      )}
      headerRightContainerStyle={styles.rightContainer}
      headerRight={() => (actions ? <View style={styles.actions}>{actions}</View> : null)}
    />
  );
}

const styles = StyleSheet.create({
  leading: {
    flexDirection: "row",
    alignItems: "center",
  },
  context: {
    minWidth: 0,
  },
  rightContainer: {
    paddingEnd: space[4],
  },
  actions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
  },
});
