import { Header } from "@react-navigation/elements";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from "react-native-reanimated";

import { color, space } from "../../shared/theme";
import { settingsStyles } from "../settings/settings-chrome";
import { SettingsHeaderBackButton } from "../settings/SettingsHeaderBackButton";
import { PROJECT_PAGE_INDEX, PROJECT_PAGES, type ProjectPage } from "./project-pager-model";
import { projectPaneStyles } from "./project-pane-chrome";
import { ProjectHeaderTabs } from "./ProjectHeaderTabs";

export type ProjectHeaderContribution = {
  context?: ReactNode;
  actions?: ReactNode;
};

type ProjectHeaderNavigation = {
  activePage: ProjectPage;
  progress: SharedValue<number>;
  onSelectPage: (page: ProjectPage) => void;
  onBack: () => void;
};

type ProjectHeaderLayersProps = {
  activePage: ProjectPage;
  progress: SharedValue<number>;
  contributions: Record<ProjectPage, ProjectHeaderContribution>;
  kind: "context" | "actions" | "combined";
};

type ProjectHeaderLayerProps = {
  active: boolean;
  index: number;
  progress: SharedValue<number>;
  alignEnd: boolean;
  children: ReactNode;
};

function ProjectHeaderLayer({
  active,
  index,
  progress,
  alignEnd,
  children,
}: ProjectHeaderLayerProps) {
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => {
    const distance = index - progress.value;
    return {
      opacity: Math.max(0, 1 - Math.abs(distance)),
      transform: [{ translateX: reduceMotion ? 0 : distance * 12 }],
    };
  });

  return (
    <Animated.View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      pointerEvents={active ? "auto" : "none"}
      style={[styles.layer, alignEnd ? styles.layerEnd : styles.layerStart, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

function ProjectHeaderLayers({
  activePage,
  progress,
  contributions,
  kind,
}: ProjectHeaderLayersProps) {
  return (
    <View
      style={[
        styles.layerHost,
        kind === "actions" && styles.actionsHost,
        kind === "combined" && styles.combinedHost,
      ]}
    >
      {PROJECT_PAGES.map((page) => {
        const contribution = contributions[page];
        const content =
          kind === "context" ? (
            contribution.context
          ) : kind === "actions" ? (
            contribution.actions ? (
              <View style={styles.actions}>{contribution.actions}</View>
            ) : null
          ) : (
            <View style={styles.combinedRow}>
              <View style={styles.combinedContext}>{contribution.context}</View>
              {contribution.actions ? (
                <View style={styles.actions}>{contribution.actions}</View>
              ) : null}
            </View>
          );
        return (
          <ProjectHeaderLayer
            key={page}
            active={page === activePage}
            index={PROJECT_PAGE_INDEX[page]}
            progress={progress}
            alignEnd={kind === "actions"}
          >
            {content}
          </ProjectHeaderLayer>
        );
      })}
    </View>
  );
}

type ProjectMediumHeaderProps = ProjectHeaderNavigation & {
  contributions: Record<ProjectPage, ProjectHeaderContribution>;
};

export function ProjectMediumHeader({
  activePage,
  progress,
  onSelectPage,
  onBack,
  contributions,
}: ProjectMediumHeaderProps) {
  return (
    <Header
      title=""
      headerTitle={() => (
        <ProjectHeaderLayers
          activePage={activePage}
          progress={progress}
          contributions={contributions}
          kind="context"
        />
      )}
      headerTitleAlign="left"
      headerTintColor={color.accent}
      headerStyle={settingsStyles.header}
      headerShadowVisible={false}
      headerLeftContainerStyle={settingsStyles.headerLeftContainer}
      headerLeft={(props) => (
        <View style={styles.leading}>
          <SettingsHeaderBackButton {...props} onPress={onBack} />
          <ProjectHeaderTabs
            activePage={activePage}
            progress={progress}
            onSelectPage={onSelectPage}
          />
        </View>
      )}
      headerRightContainerStyle={styles.rightContainer}
      headerRight={() => (
        <ProjectHeaderLayers
          activePage={activePage}
          progress={progress}
          contributions={contributions}
          kind="actions"
        />
      )}
    />
  );
}

export function ProjectCompactHeader({
  activePage,
  progress,
  onSelectPage,
  onBack,
  contributions,
}: ProjectMediumHeaderProps) {
  return (
    <>
      <Header
        title=""
        headerTitle={() => (
          <ProjectHeaderTabs
            activePage={activePage}
            progress={progress}
            onSelectPage={onSelectPage}
          />
        )}
        headerTitleAlign="center"
        headerTitleContainerStyle={styles.compactTitle}
        headerTintColor={color.accent}
        headerStyle={settingsStyles.header}
        headerShadowVisible={false}
        headerLeftContainerStyle={settingsStyles.headerLeftContainer}
        headerLeft={(props) => <SettingsHeaderBackButton {...props} onPress={onBack} />}
      />
      <View style={projectPaneStyles.header}>
        <ProjectHeaderLayers
          activePage={activePage}
          progress={progress}
          contributions={contributions}
          kind="combined"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  leading: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightContainer: {
    paddingEnd: space[4],
  },
  compactTitle: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    maxWidth: "100%",
    marginHorizontal: 0,
    alignItems: "center",
  },
  layerHost: {
    position: "relative",
    width: 180,
    height: 48,
    overflow: "hidden",
  },
  actionsHost: {
    width: 152,
  },
  combinedHost: {
    width: "100%",
    height: "100%",
  },
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
  },
  layerStart: {
    alignItems: "flex-start",
  },
  layerEnd: {
    alignItems: "flex-end",
  },
  combinedRow: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingHorizontal: space[4],
  },
  combinedContext: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
  },
});
