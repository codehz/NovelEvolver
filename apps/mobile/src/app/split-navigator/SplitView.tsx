import { type ParamListBase, StackActions } from "@react-navigation/native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import { ScreenStack, ScreenStackItem } from "react-native-screens";

import { SplitContext } from "./SplitContext";
import { SplitActions } from "./SplitRouter";
import type {
  SplitDescriptorMap,
  SplitLayout,
  SplitMasterComponentProps,
  SplitNavigationHelpers,
  SplitNavigationState,
  SplitPane,
} from "./types";

const DEFAULT_BREAKPOINT = 768;
const DEFAULT_MASTER_WIDTH = 220;
const HIDDEN_HEADER = { hidden: true };

type SplitViewProps = {
  state: SplitNavigationState<ParamListBase>;
  navigation: SplitNavigationHelpers;
  descriptors: SplitDescriptorMap;
  master: (props: SplitMasterComponentProps) => ReactNode;
  breakpoint?: number;
  masterWidth?: number;
  swipeEnabled?: boolean;
};

export function SplitView({
  state,
  navigation,
  descriptors,
  master,
  breakpoint = DEFAULT_BREAKPOINT,
  masterWidth = DEFAULT_MASTER_WIDTH,
  swipeEnabled = true,
}: SplitViewProps) {
  const { width } = useWindowDimensions();
  const layout: SplitLayout = width >= breakpoint ? "wide" : "compact";
  const pane = state.pane;
  const focusedRouteKey = state.routes[state.index]?.key;
  const [loaded, setLoaded] = useState(() => (focusedRouteKey ? [focusedRouteKey] : []));

  if (focusedRouteKey && !loaded.includes(focusedRouteKey)) {
    setLoaded([...loaded, focusedRouteKey]);
  }

  const previousRouteKeyRef = useRef(focusedRouteKey);

  useEffect(() => {
    const previousRouteKey = previousRouteKeyRef.current;
    if (
      previousRouteKey != null &&
      previousRouteKey !== focusedRouteKey &&
      descriptors[previousRouteKey]?.options.popToTopOnBlur
    ) {
      const currentState = navigation.getState();
      const prevRoute = currentState.routes.find((route) => route.key === previousRouteKey);
      if (
        prevRoute?.state?.type === "stack" &&
        prevRoute.state.key &&
        (prevRoute.state.index ?? prevRoute.state.routes.length - 1) > 0
      ) {
        navigation.dispatch({
          ...StackActions.popToTop(),
          target: prevRoute.state.key,
        });
      }
    }
    previousRouteKeyRef.current = focusedRouteKey;
  }, [descriptors, focusedRouteKey, navigation]);

  const showMaster = () => {
    navigation.dispatch(SplitActions.showMaster());
  };
  const showDetail = () => {
    navigation.dispatch(SplitActions.showDetail());
  };

  useEffect(() => {
    if (layout === "wide" && pane !== "detail") {
      navigation.dispatch(SplitActions.showDetail());
    }
  }, [layout, pane, navigation]);

  const masterElement = master({
    state,
    navigation,
    descriptors,
    layout,
    pane,
  });

  const scenes = (
    <View style={styles.scenes}>
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        const isFocused = state.index === index;
        const lazy = descriptor.options.lazy ?? true;
        if (lazy && !loaded.includes(route.key) && !isFocused) {
          return null;
        }
        return (
          <View
            key={route.key}
            style={[styles.scene, isFocused ? styles.sceneFocused : styles.sceneHidden]}
            pointerEvents={isFocused ? "auto" : "none"}
            accessibilityElementsHidden={!isFocused}
            importantForAccessibility={isFocused ? "auto" : "no-hide-descendants"}
          >
            {descriptor.render()}
          </View>
        );
      })}
    </View>
  );

  const contextValue = { layout, pane, showMaster, showDetail };

  if (layout === "wide") {
    return (
      <SplitContext.Provider value={contextValue}>
        <View style={styles.wideRoot} collapsable={false}>
          <View style={[styles.wideMaster, { width: masterWidth }]} collapsable={false}>
            {masterElement}
          </View>
          <View style={styles.wideDetail} collapsable={false}>
            {scenes}
          </View>
        </View>
      </SplitContext.Provider>
    );
  }

  return (
    <SplitContext.Provider value={contextValue}>
      <CompactSplitPanes
        masterElement={masterElement}
        scenes={scenes}
        pane={pane}
        swipeEnabled={swipeEnabled}
        showMaster={showMaster}
      />
    </SplitContext.Provider>
  );
}

type CompactSplitPanesProps = {
  masterElement: ReactNode;
  scenes: ReactNode;
  pane: SplitPane;
  swipeEnabled: boolean;
  showMaster: () => void;
};

function CompactSplitPanes({
  masterElement,
  scenes,
  pane,
  swipeEnabled,
  showMaster,
}: CompactSplitPanesProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <ScreenStack style={styles.compactRoot}>
      <ScreenStackItem
        screenId="split-master"
        activityState={2}
        style={StyleSheet.absoluteFill}
        headerConfig={HIDDEN_HEADER}
      >
        {masterElement}
      </ScreenStackItem>
      {pane === "detail" ? (
        <ScreenStackItem
          screenId="split-detail"
          activityState={2}
          style={StyleSheet.absoluteFill}
          headerConfig={HIDDEN_HEADER}
          stackAnimation={ready ? "default" : "none"}
          gestureEnabled={Platform.OS === "ios" && swipeEnabled}
          nativeBackButtonDismissalEnabled={false}
          onDismissed={showMaster}
          contentStyle={styles.flex}
        >
          {scenes}
        </ScreenStackItem>
      ) : null}
    </ScreenStack>
  );
}

const styles = StyleSheet.create({
  wideRoot: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  wideMaster: {
    flexShrink: 0,
    // Native-stack transitions paint in the detail pane and overflow left;
    // keep the rail above them so the outgoing screen slides under it.
    zIndex: 2,
    elevation: 8,
  },
  wideDetail: {
    flex: 1,
    minWidth: 0,
    zIndex: 0,
    overflow: "hidden",
  },
  compactRoot: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scenes: {
    flex: 1,
    overflow: "hidden",
  },
  scene: {
    ...StyleSheet.absoluteFill,
  },
  sceneFocused: {
    zIndex: 1,
  },
  sceneHidden: {
    opacity: 0,
    zIndex: 0,
  },
});
