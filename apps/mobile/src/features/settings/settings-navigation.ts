export type SettingsDetail =
  | { type: "provider-editor"; id?: string }
  | { type: "model-editor"; id?: string; providerId?: string }
  | { type: "agent-editor"; id?: string }
  | { type: "prompt-editor"; id?: string }
  | { type: "ai-runtime-policy" };

export type SettingsNavigationState =
  | { screen: "master" }
  | { screen: "detail"; detail: SettingsDetail };

export type SettingsNavigationAction =
  | { type: "open-detail"; detail: SettingsDetail }
  | { type: "show-master" };

export const initialSettingsNavigationState: SettingsNavigationState = { screen: "master" };

export function settingsNavigationReducer(
  state: SettingsNavigationState,
  action: SettingsNavigationAction,
): SettingsNavigationState {
  switch (action.type) {
    case "open-detail":
      return { screen: "detail", detail: action.detail };
    case "show-master":
      return state.screen === "master" ? state : initialSettingsNavigationState;
  }
}

export function isSettingsDetail(
  state: SettingsNavigationState,
): state is { screen: "detail"; detail: SettingsDetail } {
  return state.screen === "detail";
}
