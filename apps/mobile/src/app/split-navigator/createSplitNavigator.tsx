import {
  createNavigatorFactory,
  createScreenFactory,
  type NavigatorTypeBagBase,
  type ParamListBase,
  type StaticConfig,
  type TypedNavigator,
  useNavigationBuilder,
  usePreventRemove,
} from "@react-navigation/native";
import { useWindowDimensions } from "react-native";

import { SplitActions, SplitRouter } from "./SplitRouter";
import { SplitView } from "./SplitView";
import type {
  SplitActionHelpers,
  SplitNavigationEventMap,
  SplitNavigationOptions,
  SplitNavigationProp,
  SplitNavigationState,
  SplitNavigatorProps,
  SplitRouterOptions,
} from "./types";

const DEFAULT_BREAKPOINT = 768;

function SplitNavigator({
  id,
  initialRouteName,
  UNSTABLE_routeNamesChangeBehavior,
  children,
  layout,
  screenListeners,
  screenOptions,
  screenLayout,
  UNSTABLE_router,
  master,
  breakpoint = DEFAULT_BREAKPOINT,
  masterWidth,
  swipeEnabled,
  onLeaveDetail,
  showDetailOnWide,
  detailPlaceholder,
}: SplitNavigatorProps) {
  const { state, descriptors, navigation, NavigationContent } = useNavigationBuilder<
    SplitNavigationState<ParamListBase>,
    SplitRouterOptions,
    SplitActionHelpers<ParamListBase>,
    SplitNavigationOptions,
    SplitNavigationEventMap
  >(SplitRouter, {
    id,
    initialRouteName,
    UNSTABLE_routeNamesChangeBehavior,
    children,
    layout,
    screenListeners,
    screenOptions,
    screenLayout,
    UNSTABLE_router,
    backBehavior: "none",
  });

  const { width } = useWindowDimensions();
  const wide = width >= breakpoint;

  usePreventRemove(!wide && state.pane === "detail", () => {
    void Promise.resolve(onLeaveDetail?.() ?? true).then((ok) => {
      if (ok) {
        navigation.dispatch(SplitActions.showMaster());
      }
    });
  });

  return (
    <NavigationContent>
      <SplitView
        state={state}
        descriptors={descriptors}
        navigation={navigation}
        master={master}
        breakpoint={breakpoint}
        masterWidth={masterWidth}
        swipeEnabled={swipeEnabled}
        showDetailOnWide={showDetailOnWide}
        detailPlaceholder={detailPlaceholder}
      />
    </NavigationContent>
  );
}

export type SplitTypeBag<
  ParamList extends ParamListBase = ParamListBase,
  NavigatorID extends string | undefined = string | undefined,
> = {
  ParamList: ParamList;
  NavigatorID: NavigatorID;
  State: SplitNavigationState<ParamList>;
  ScreenOptions: SplitNavigationOptions;
  EventMap: SplitNavigationEventMap;
  NavigationList: {
    [RouteName in keyof ParamList]: SplitNavigationProp<ParamList, RouteName, NavigatorID>;
  };
  Navigator: typeof SplitNavigator;
};

export function createSplitNavigator<
  const ParamList extends ParamListBase,
  const NavigatorID extends string | undefined = string | undefined,
  const TypeBag extends NavigatorTypeBagBase = SplitTypeBag<ParamList, NavigatorID>,
  const Config extends StaticConfig<TypeBag> = StaticConfig<TypeBag>,
>(config?: Config): TypedNavigator<TypeBag, Config> {
  return createNavigatorFactory(SplitNavigator)(config);
}

export const createSplitScreen = createScreenFactory<SplitTypeBag>();
