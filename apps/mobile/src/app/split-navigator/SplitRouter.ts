import {
  type CommonNavigationAction,
  type NavigationAction,
  type ParamListBase,
  type PartialState,
  type Router,
  type RouterConfigOptions,
  TabActions,
  type TabActionType,
  type TabNavigationState,
  TabRouter,
  type TabRouterOptions,
} from "@react-navigation/native";

import type { SplitActionType, SplitNavigationState, SplitPane } from "./types";

export const SplitActions = {
  ...TabActions,
  showMaster() {
    return { type: "SHOW_MASTER" } as const satisfies SplitActionType;
  },
  showDetail() {
    return { type: "SHOW_DETAIL" } as const satisfies SplitActionType;
  },
};

type TabState = TabNavigationState<ParamListBase>;
type SplitState = SplitNavigationState<ParamListBase>;
type SplitAction = SplitActionType | TabActionType | CommonNavigationAction;

function asTabState(state: SplitState): TabState {
  return state as unknown as TabState;
}

function toSplitState(state: TabState, pane: SplitPane): SplitState {
  return { ...state, type: "split", pane } as unknown as SplitState;
}

function setPane(state: SplitState, pane: SplitPane): SplitState {
  if (state.pane === pane) {
    return state;
  }
  return { ...state, pane };
}

export function SplitRouter(options: TabRouterOptions): Router<SplitState, SplitAction> {
  const router = TabRouter({ ...options, backBehavior: "none" });

  return {
    type: "split",
    getInitialState(routerOptions: RouterConfigOptions) {
      return toSplitState(router.getInitialState(routerOptions), "master");
    },
    getRehydratedState(
      partialState: PartialState<SplitState> | SplitState,
      routerOptions: RouterConfigOptions,
    ) {
      if (partialState.stale === false) {
        return partialState;
      }
      const pane: SplitPane =
        "pane" in partialState && partialState.pane === "detail" ? "detail" : "master";
      return toSplitState(
        router.getRehydratedState(partialState as unknown as PartialState<TabState>, routerOptions),
        pane,
      );
    },
    getStateForRouteNamesChange(
      state: SplitState,
      changeOptions: RouterConfigOptions & { routeKeyChanges: string[] },
    ) {
      return toSplitState(
        router.getStateForRouteNamesChange(asTabState(state), changeOptions),
        state.pane,
      );
    },
    getStateForRouteFocus(state: SplitState, key: string) {
      return setPane(
        toSplitState(router.getStateForRouteFocus(asTabState(state), key), state.pane),
        "detail",
      );
    },
    getStateForAction(state: SplitState, action: SplitAction, actionOptions: RouterConfigOptions) {
      switch (action.type) {
        case "SHOW_MASTER":
          return setPane(state, "master");
        case "SHOW_DETAIL":
          return setPane(state, "detail");
        case "JUMP_TO":
        case "NAVIGATE":
        case "NAVIGATE_DEPRECATED": {
          const result = router.getStateForAction(asTabState(state), action, actionOptions);
          if (result == null || result.stale !== false) {
            return result as SplitState | PartialState<SplitState> | null;
          }
          return setPane(toSplitState(result, state.pane), "detail");
        }
        default: {
          const result = router.getStateForAction(asTabState(state), action, actionOptions);
          if (result == null || result.stale !== false) {
            return result as SplitState | PartialState<SplitState> | null;
          }
          return toSplitState(result, state.pane);
        }
      }
    },
    shouldActionChangeFocus(action: NavigationAction) {
      return router.shouldActionChangeFocus(action);
    },
    actionCreators: SplitActions,
  };
}
