import { createDrawerNavigator } from "@react-navigation/drawer";
import { createStaticNavigation, DarkTheme, type Theme } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from "@react-navigation/native-stack";
import { useWindowDimensions } from "react-native";

import { HomeScreen } from "../features/home/HomeScreen";
import { AgentEditor, AiAgentsList } from "../features/settings/ai-agents/AiAgentsPanel";
import {
  AiModelsList,
  ModelEditor,
  ProviderEditor,
} from "../features/settings/ai-models/AiModelsPanel";
import { AiPromptsList, PromptEditor } from "../features/settings/ai-prompts/AiPromptsPanel";
import { AiRuntimePolicyPanel } from "../features/settings/ai-runtime-policy/AiRuntimePolicyPanel";
import {
  SETTINGS_RAIL_WIDTH,
  WIDE_SETTINGS_BREAKPOINT,
} from "../features/settings/settings-chrome";
import { useSettingsDirty, useSettingsEditorOpen } from "../features/settings/settings-leave-guard";
import { SettingsDrawerContent } from "../features/settings/SettingsDrawerContent";
import { SettingsHeaderButton } from "../features/settings/SettingsHeaderButton";
import { SettingsListHeaderLeft } from "../features/settings/SettingsListHeaderLeft";
import { color, fontSize, wash } from "../shared/theme";

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

const stackScreenOptions = {
  headerStyle: { backgroundColor: color.background },
  headerTintColor: color.accent,
  headerTitleStyle: {
    color: color.foreground,
    fontSize: fontSize.md,
    fontWeight: "600" as const,
  },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal" as const,
  contentStyle: { backgroundColor: color.background },
};

const AiModelsStack = createNativeStackNavigator({
  screenOptions: stackScreenOptions,
  screens: {
    List: createNativeStackScreen({
      screen: AiModelsList,
      options: ({ navigation }) => ({
        title: "AI 模型",
        headerLeft: (props) => <SettingsListHeaderLeft {...props} />,
        headerRight: () => (
          <SettingsHeaderButton
            label="添加供应商"
            onPress={() => {
              navigation.navigate("ProviderEditor", {});
            }}
          />
        ),
      }),
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
  },
});

const AiAgentsStack = createNativeStackNavigator({
  screenOptions: stackScreenOptions,
  screens: {
    List: createNativeStackScreen({
      screen: AiAgentsList,
      options: ({ navigation }) => ({
        title: "AI Agent",
        headerLeft: (props) => <SettingsListHeaderLeft {...props} />,
        headerRight: () => (
          <SettingsHeaderButton
            label="添加"
            onPress={() => {
              navigation.navigate("AgentEditor", {});
            }}
          />
        ),
      }),
    }),
    AgentEditor: createNativeStackScreen({
      screen: AgentEditor,
      options: ({ route }) => ({
        title: route.params.id == null ? "添加 Agent" : "编辑 Agent",
      }),
    }),
  },
});

const AiPromptsStack = createNativeStackNavigator({
  screenOptions: stackScreenOptions,
  screens: {
    List: createNativeStackScreen({
      screen: AiPromptsList,
      options: ({ navigation }) => ({
        title: "AI 提示词",
        headerLeft: (props) => <SettingsListHeaderLeft {...props} />,
        headerRight: () => (
          <SettingsHeaderButton
            label="添加"
            onPress={() => {
              navigation.navigate("PromptEditor", {});
            }}
          />
        ),
      }),
    }),
    PromptEditor: createNativeStackScreen({
      screen: PromptEditor,
      options: ({ route }) => ({
        title: route.params.id == null ? "添加提示词" : "编辑提示词",
      }),
    }),
  },
});

const AiRuntimePolicyStack = createNativeStackNavigator({
  screenOptions: stackScreenOptions,
  screens: {
    List: {
      screen: AiRuntimePolicyPanel,
      options: {
        title: "AI 运行策略",
        headerLeft: (props) => <SettingsListHeaderLeft {...props} />,
      },
    },
  },
});

const SettingsDrawer = createDrawerNavigator({
  defaultStatus: "open",
  drawerContent: (props) => <SettingsDrawerContent {...props} />,
  screenOptions: {
    headerShown: false,
    popToTopOnBlur: true,
    drawerActiveTintColor: color.accent,
    drawerInactiveTintColor: color.foreground,
    drawerActiveBackgroundColor: color.background,
  },
  screens: {
    "ai-models": AiModelsStack,
    "ai-agents": AiAgentsStack,
    "ai-prompts": AiPromptsStack,
    "ai-runtime-policy": AiRuntimePolicyStack,
  },
}).with(({ Navigator }) => {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_SETTINGS_BREAKPOINT;
  const dirty = useSettingsDirty();
  const editorOpen = useSettingsEditorOpen();

  return (
    <Navigator
      backBehavior={wide ? "none" : "firstRoute"}
      screenOptions={{
        drawerType: wide ? "permanent" : "front",
        drawerStyle: {
          backgroundColor: color.surface,
          width: wide ? SETTINGS_RAIL_WIDTH : "100%",
        },
        overlayColor: wide ? "transparent" : wash.backdrop,
        swipeEnabled: !wide && !dirty && !editorOpen,
      }}
    />
  );
});

const RootStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    contentStyle: { backgroundColor: color.background },
  },
  screens: {
    Home: HomeScreen,
    Settings: SettingsDrawer,
  },
});

type RootStackType = typeof RootStack;

declare module "@react-navigation/core" {
  interface RootNavigator extends RootStackType {}
}

const Navigation = createStaticNavigation(RootStack);

export function RootNavigation() {
  return <Navigation theme={navigationTheme} />;
}
