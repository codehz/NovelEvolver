import type { HeaderBackButtonProps } from "@react-navigation/elements";
import { createStaticNavigation, DarkTheme, type Theme } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  createNativeStackScreen,
  type NativeStackNavigationOptions,
} from "@react-navigation/native-stack";
import { useWindowDimensions } from "react-native";

import { ProjectListScreen } from "../features/projects/ProjectListScreen";
import { ProjectScreen } from "../features/projects/ProjectScreen";
import { AgentEditor } from "../features/settings/ai-agents/AiAgentsPanel";
import { ModelEditor, ProviderEditor } from "../features/settings/ai-models/AiModelsPanel";
import { PromptEditor } from "../features/settings/ai-prompts/AiPromptsPanel";
import { AiRuntimePolicyPanel } from "../features/settings/ai-runtime-policy/AiRuntimePolicyPanel";
import {
  SETTINGS_RAIL_WIDTH,
  WIDE_SETTINGS_BREAKPOINT,
} from "../features/settings/settings-chrome";
import {
  requestSettingsLeave,
  useSettingsDirty,
  useSettingsEditorOpen,
} from "../features/settings/settings-leave-guard";
import { SettingsDetailPlaceholder } from "../features/settings/SettingsDetailPlaceholder";
import { SettingsListHeaderLeft } from "../features/settings/SettingsListHeaderLeft";
import { SettingsMasterPane } from "../features/settings/SettingsMasterPane";
import { color, fontFamily, fontSize } from "../shared/theme";
import { AlertScreen, ConfirmScreen, PromptScreen } from "../shared/ui/OverlayHost";
import { navigationRef } from "./navigation-ref";
import { createSplitNavigator } from "./split-navigator";

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: color.accent,
    background: color.background,
    card: color.background,
    text: color.foreground,
    border: color.border,
    notification: color.accent,
  },
};

function SettingsDetailHeaderLeft(props: HeaderBackButtonProps) {
  const { width } = useWindowDimensions();
  return width < WIDE_SETTINGS_BREAKPOINT ? <SettingsListHeaderLeft {...props} /> : null;
}

const stackScreenOptions = (): NativeStackNavigationOptions => ({
  headerStyle: { backgroundColor: color.background },
  headerTintColor: color.accent,
  headerTitleStyle: {
    color: color.foreground,
    fontFamily: fontFamily.sans,
    fontSize: fontSize.md,
    fontWeight: "600" as const,
  },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
  contentStyle: { backgroundColor: color.background },
  headerLeft: (props) => <SettingsDetailHeaderLeft {...props} />,
});

const SettingsDetailStack = createNativeStackNavigator({
  screenOptions: stackScreenOptions,
  screens: {
    Empty: createNativeStackScreen({
      screen: SettingsDetailPlaceholder,
      options: { headerShown: false },
    }),
    ProviderEditor: createNativeStackScreen({
      screen: ProviderEditor,
      options: ({ route }) => ({
        title: route.params.id == null ? "添加供应商" : "编辑供应商",
      }),
    }),
    ModelEditor: createNativeStackScreen({
      screen: ModelEditor,
      options: ({ route }) => ({
        title: route.params.id == null ? "添加模型" : "编辑模型",
      }),
    }),
    AgentEditor: createNativeStackScreen({
      screen: AgentEditor,
      options: ({ route }) => ({
        title: route.params.id == null ? "添加 Agent" : "编辑 Agent",
      }),
    }),
    PromptEditor: createNativeStackScreen({
      screen: PromptEditor,
      options: ({ route }) => ({
        title: route.params.id == null ? "添加提示词" : "编辑提示词",
      }),
    }),
    AiRuntimePolicy: createNativeStackScreen({
      screen: AiRuntimePolicyPanel,
      options: { title: "AI 运行策略" },
    }),
  },
});

const SettingsSplit = createSplitNavigator({
  master: (props) => <SettingsMasterPane {...props} />,
  breakpoint: WIDE_SETTINGS_BREAKPOINT,
  masterWidth: SETTINGS_RAIL_WIDTH,
  showDetailOnWide: false,
  detailPlaceholder: <SettingsDetailPlaceholder />,
  onLeaveDetail: requestSettingsLeave,
  screens: {
    detail: { screen: SettingsDetailStack },
  },
}).with(({ Navigator }) => {
  const dirty = useSettingsDirty();
  const editorOpen = useSettingsEditorOpen();

  return <Navigator swipeEnabled={!dirty && !editorOpen} />;
});

const overlayScreenOptions = {
  headerShown: false,
  presentation: "transparentModal",
  animation: "none",
  gestureEnabled: false,
  contentStyle: { backgroundColor: "transparent" },
} satisfies NativeStackNavigationOptions;

const RootStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    contentStyle: { backgroundColor: color.background },
  },
  screens: {
    Home: ProjectListScreen,
    Project: createNativeStackScreen({
      screen: ProjectScreen,
      options: { headerShown: false },
    }),
    Settings: SettingsSplit,
    Alert: createNativeStackScreen({ screen: AlertScreen, options: overlayScreenOptions }),
    Confirm: createNativeStackScreen({ screen: ConfirmScreen, options: overlayScreenOptions }),
    Prompt: createNativeStackScreen({ screen: PromptScreen, options: overlayScreenOptions }),
  },
});

type RootStackType = typeof RootStack;

declare module "@react-navigation/core" {
  interface RootNavigator extends RootStackType {}
}

const Navigation = createStaticNavigation(RootStack);

export function RootNavigation() {
  return <Navigation ref={navigationRef} theme={navigationTheme} />;
}
