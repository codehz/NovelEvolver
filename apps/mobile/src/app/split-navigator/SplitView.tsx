import { type ParamListBase, StackActions } from "@react-navigation/native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { SplitContext } from "./SplitContext";
import { SplitActions } from "./SplitRouter";
import type {
  SplitDescriptorMap,
  SplitLayout,
  SplitMasterComponentProps,
  SplitNavigationHelpers,
  SplitNavigationState,
} from "./types";

const DEFAULT_BREAKPOINT = 768;
const DEFAULT_MASTER_WIDTH = 220;
const PANE_TIMING = {
  duration: 320,
  easing: Easing.bezier(0.32, 0.72, 0, 1),
};

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

  const progress = useSharedValue(pane === "detail" ? 1 : 0);
  const paneWidth = useSharedValue(width);
  const skipTimingRef = useRef(true);

  useEffect(() => {
    paneWidth.value = width;
  }, [paneWidth, width]);

  useEffect(() => {
    const target = pane === "detail" ? 1 : 0;
    if (skipTimingRef.current) {
      skipTimingRef.current = false;
      progress.value = target;
      return;
    }
    progress.value = withTiming(target, PANE_TIMING);
  }, [pane, progress]);

  const compactStyle = useAnimatedStyle(() => ({
    width: paneWidth.value * 2,
    transform: [{ translateX: -progress.value * paneWidth.value }],
  }));

  const panEnabled = layout === "compact" && pane === "detail" && swipeEnabled;
  const pan = usePanGesture({
    enabled: panEnabled,
    activeOffsetX: 16,
    failOffsetY: [-20, 20],
    onUpdate: (event) => {
      "worklet";
      const next = 1 - event.translationX / paneWidth.value;
      progress.value = Math.min(1, Math.max(0, next));
    },
    onDeactivate: (event) => {
      "worklet";
      if (event.canceled) {
        progress.value = withTiming(1, PANE_TIMING);
        return;
      }
      const shouldMaster = progress.value < 0.55 || event.velocityX > 700;
      if (shouldMaster) {
        progress.value = withTiming(0, PANE_TIMING);
        runOnJS(showMaster)();
      } else {
        progress.value = withTiming(1, PANE_TIMING);
      }
    },
  });

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
      <GestureDetector gesture={pan}>
        <View style={styles.compactRoot}>
          <Animated.View style={[styles.compactTrack, compactStyle]} collapsable={false}>
            <View
              style={[styles.compactPane, { width }]}
              pointerEvents={pane === "master" ? "auto" : "none"}
              accessibilityElementsHidden={pane !== "master"}
              importantForAccessibility={pane === "master" ? "auto" : "no-hide-descendants"}
            >
              {masterElement}
            </View>
            <View
              style={[styles.compactPane, { width }]}
              pointerEvents={pane === "detail" ? "auto" : "none"}
              accessibilityElementsHidden={pane !== "detail"}
              importantForAccessibility={pane === "detail" ? "auto" : "no-hide-descendants"}
            >
              {scenes}
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
    </SplitContext.Provider>
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
    overflow: "hidden",
  },
  compactTrack: {
    flex: 1,
    flexDirection: "row",
  },
  compactPane: {
    flexShrink: 0,
    height: "100%",
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
