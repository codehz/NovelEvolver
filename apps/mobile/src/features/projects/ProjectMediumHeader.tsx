import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, type SharedValue } from "react-native-reanimated";

import { color, space } from "../../shared/theme";
import { SettingsHeaderBackButton } from "../settings/SettingsHeaderBackButton";
import type { ProjectPage } from "./project-pager-model";
import { projectPaneStyles, PROJECT_PANE_HEADER_HEIGHT } from "./project-pane-chrome";
import { ProjectHeaderTabs } from "./ProjectHeaderTabs";

export type ProjectHeaderContribution = {
  context?: ReactNode;
  actions?: ReactNode;
};

const PROJECT_HEADER_HEIGHT = PROJECT_PANE_HEADER_HEIGHT;
const PROJECT_COMPACT_CONTENT_HEADER_HEIGHT = 48;

type ProjectHeaderNavigation = {
  activePage: ProjectPage;
  progress: SharedValue<number>;
  onSelectPage: (page: ProjectPage) => void;
  onBack: () => void;
  topInset: number;
};

type ProjectHeaderLayersProps = {
  activePage: ProjectPage;
  contributions: Record<ProjectPage, ProjectHeaderContribution>;
  kind: "context" | "actions" | "combined";
};

function ProjectHeaderLayer({ children }: { children: ReactNode }) {
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(120)}
      style={styles.layer}
    >
      {children}
    </Animated.View>
  );
}

function ProjectHeaderLayers({ activePage, contributions, kind }: ProjectHeaderLayersProps) {
  const contribution = contributions[activePage];
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
        {contribution.actions ? <View style={styles.actions}>{contribution.actions}</View> : null}
      </View>
    );

  return (
    <View
      style={[
        styles.layerHost,
        kind === "actions" && styles.actionLayerHost,
        kind === "combined" && styles.combinedLayerHost,
      ]}
    >
      <ProjectHeaderLayer key={`${kind}-${activePage}`}>{content}</ProjectHeaderLayer>
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
  topInset,
  contributions,
}: ProjectMediumHeaderProps) {
  return (
    <View
      style={[styles.header, { height: PROJECT_HEADER_HEIGHT + topInset, paddingTop: topInset }]}
    >
      <View style={styles.leading}>
        <SettingsHeaderBackButton tintColor={color.accent} onPress={onBack} />
        <ProjectHeaderTabs
          activePage={activePage}
          progress={progress}
          onSelectPage={onSelectPage}
        />
      </View>
      <View style={styles.contextSlot}>
        <ProjectHeaderLayers activePage={activePage} contributions={contributions} kind="context" />
      </View>
      <View style={styles.actionsSlot}>
        <ProjectHeaderLayers activePage={activePage} contributions={contributions} kind="actions" />
      </View>
    </View>
  );
}

export function ProjectCompactHeader({
  activePage,
  progress,
  onSelectPage,
  onBack,
  topInset,
  contributions,
}: ProjectMediumHeaderProps) {
  return (
    <>
      <View
        style={[styles.header, { height: PROJECT_HEADER_HEIGHT + topInset, paddingTop: topInset }]}
      >
        <View style={styles.compactSide}>
          <SettingsHeaderBackButton tintColor={color.accent} onPress={onBack} />
        </View>
        <View style={styles.compactTabs}>
          <ProjectHeaderTabs
            activePage={activePage}
            progress={progress}
            onSelectPage={onSelectPage}
          />
        </View>
        <View style={styles.compactSide} />
      </View>
      <View style={[projectPaneStyles.header, styles.compactContentHeader]}>
        <ProjectHeaderLayers
          activePage={activePage}
          contributions={contributions}
          kind="combined"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: PROJECT_HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space[4],
    backgroundColor: color.surface,
  },
  leading: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  compactSide: {
    width: 40,
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  compactTabs: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  compactContentHeader: {
    height: PROJECT_COMPACT_CONTENT_HEADER_HEIGHT,
  },
  contextSlot: {
    flex: 1,
    minWidth: 0,
    marginStart: space[3],
  },
  actionsSlot: {
    flexShrink: 0,
    marginStart: space[3],
  },
  layerHost: {
    width: "100%",
    minHeight: 48,
    overflow: "hidden",
  },
  actionLayerHost: {
    width: "auto",
  },
  combinedLayerHost: {
    flex: 1,
    minHeight: 0,
  },
  layer: {
    flex: 1,
    justifyContent: "center",
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
    alignItems: "flex-start",
  },
  actions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space[1],
  },
});
