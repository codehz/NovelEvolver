import {
  createStaticNavigation,
  DarkTheme,
  type ParamListBase,
  type Theme,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  createNativeStackScreen,
  type NativeStackNavigationOptions,
  type NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import IconAdd from "~icons/codicon/add";

import { ChapterEditorScreen } from "../features/projects/ChapterEditorScreen";
import { CreateProjectScreen } from "../features/projects/CreateProjectScreen";
import { ProjectListScreen } from "../features/projects/ProjectListScreen";
import { ProjectScreen } from "../features/projects/ProjectScreen";
import { AgentEditor, AiAgentsList } from "../features/settings/ai-agents/AiAgentsPanel";
import {
  AiModelsList,
  ModelEditor,
  ProviderEditor,
} from "../features/settings/ai-models/AiModelsPanel";
import { AiPromptsList, PromptEditor } from "../features/settings/ai-prompts/AiPromptsPanel";
import { AiRuntimePolicyPanel } from "../features/settings/ai-runtime-policy/AiRuntimePolicyPanel";
import { ConfirmScreen } from "../features/settings/ConfirmHost";
import {
  SETTINGS_RAIL_WIDTH,
  WIDE_SETTINGS_BREAKPOINT,
} from "../features/settings/settings-chrome";
import {
  requestSettingsLeave,
  useSettingsDirty,
  useSettingsEditorOpen,
} from "../features/settings/settings-leave-guard";
import { SettingsHeaderBackButton } from "../features/settings/SettingsHeaderBackButton";
import { SettingsHeaderButton } from "../features/settings/SettingsHeaderButton";
import { SettingsListHeaderLeft } from "../features/settings/SettingsListHeaderLeft";
import { SettingsMasterPane } from "../features/settings/SettingsMasterPane";
import { color, fontFamily, fontSize } from "../shared/theme";
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

const stackScreenOptions = ({
  navigation,
}: {
  navigation: NativeStackNavigationProp<ParamListBase>;
}): NativeStackNavigationOptions => ({
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
  headerLeft: (props) => (
    <SettingsHeaderBackButton {...props} onPress={() => navigation.goBack()} />
  ),
});

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
            Icon={IconAdd}
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
            Icon={IconAdd}
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

const SettingsSplit = createSplitNavigator({
  master: (props) => <SettingsMasterPane {...props} />,
  breakpoint: WIDE_SETTINGS_BREAKPOINT,
  masterWidth: SETTINGS_RAIL_WIDTH,
  onLeaveDetail: requestSettingsLeave,
  screenOptions: {
    popToTopOnBlur: true,
  },
  screens: {
    "ai-models": AiModelsStack,
    "ai-agents": AiAgentsStack,
    "ai-prompts": AiPromptsStack,
    "ai-runtime-policy": AiRuntimePolicyStack,
  },
}).with(({ Navigator }) => {
  const dirty = useSettingsDirty();
  const editorOpen = useSettingsEditorOpen();

  return <Navigator swipeEnabled={!dirty && !editorOpen} />;
});

const RootStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    contentStyle: { backgroundColor: color.background },
  },
  screens: {
    Home: ProjectListScreen,
    CreateProject: createNativeStackScreen({
      screen: CreateProjectScreen,
      options: { headerShown: false },
    }),
    Project: createNativeStackScreen({
      screen: ProjectScreen,
      options: { headerShown: false },
    }),
    Chapter: createNativeStackScreen({
      screen: ChapterEditorScreen,
      options: { headerShown: false },
    }),
    Settings: SettingsSplit,
    Confirm: createNativeStackScreen({
      screen: ConfirmScreen,
      options: {
        headerShown: false,
        presentation: "transparentModal",
        animation: "none",
        gestureEnabled: false,
        contentStyle: { backgroundColor: "transparent" },
      },
    }),
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
