import type {
  DefaultNavigatorOptions,
  Descriptor,
  NavigationHelpers,
  NavigationProp,
  ParamListBase,
  RouteProp,
  TabActionHelpers,
  TabNavigationState,
  TabRouterOptions,
} from "@react-navigation/native";
import type { ReactNode } from "react";

export type SplitPane = "master" | "detail";
export type SplitLayout = "compact" | "wide";

export type SplitActionType =
  | { type: "SHOW_MASTER"; source?: string; target?: string }
  | { type: "SHOW_DETAIL"; source?: string; target?: string };

export type SplitNavigationState<ParamList extends ParamListBase> = Omit<
  TabNavigationState<ParamList>,
  "type"
> & {
  type: "split";
  pane: SplitPane;
};

export type SplitActionHelpers<ParamList extends ParamListBase> = TabActionHelpers<ParamList> & {
  showMaster(): void;
  showDetail(): void;
};

export type SplitNavigationEventMap = {
  transitionStart: { data: { closing: boolean } };
  transitionEnd: { data: { closing: boolean } };
  gestureStart: { data: undefined };
  gestureEnd: { data: undefined };
  gestureCancel: { data: undefined };
};

export type SplitNavigationOptions = {
  title?: string;
  lazy?: boolean;
  popToTopOnBlur?: boolean;
};

export type SplitNavigationHelpers = NavigationHelpers<ParamListBase, SplitNavigationEventMap> &
  SplitActionHelpers<ParamListBase>;

export type SplitNavigationProp<
  ParamList extends ParamListBase,
  RouteName extends keyof ParamList = keyof ParamList,
  NavigatorID extends string | undefined = undefined,
> = NavigationProp<
  ParamList,
  RouteName,
  NavigatorID,
  SplitNavigationState<ParamList>,
  SplitNavigationOptions,
  SplitNavigationEventMap
> &
  SplitActionHelpers<ParamList>;

export type SplitDescriptor = Descriptor<
  SplitNavigationOptions,
  SplitNavigationProp<ParamListBase>,
  RouteProp<ParamListBase>
>;

export type SplitDescriptorMap = Record<string, SplitDescriptor>;

export type SplitMasterComponentProps = {
  state: SplitNavigationState<ParamListBase>;
  navigation: SplitNavigationHelpers;
  descriptors: SplitDescriptorMap;
  layout: SplitLayout;
  pane: SplitPane;
};

export type SplitNavigationConfig = {
  master: (props: SplitMasterComponentProps) => ReactNode;
  breakpoint?: number;
  masterWidth?: number;
  swipeEnabled?: boolean;
  onLeaveDetail?: () => boolean | Promise<boolean>;
  showDetailOnWide?: boolean;
  detailPlaceholder?: ReactNode;
};

export type SplitRouterOptions = TabRouterOptions;

export type SplitNavigatorProps = DefaultNavigatorOptions<
  ParamListBase,
  string | undefined,
  SplitNavigationState<ParamListBase>,
  SplitNavigationOptions,
  SplitNavigationEventMap,
  SplitNavigationProp<ParamListBase>
> &
  SplitRouterOptions &
  SplitNavigationConfig;
