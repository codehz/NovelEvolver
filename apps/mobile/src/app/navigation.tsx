import { createStaticNavigation, DarkTheme, type Theme } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  createNativeStackScreen,
  type NativeStackNavigationOptions,
} from "@react-navigation/native-stack";

import { ProjectListScreen } from "../features/projects/ProjectListScreen";
import { ProjectScreen } from "../features/projects/ProjectScreen";
import { SettingsNavigator } from "../features/settings/SettingsNavigator";
import { color } from "../shared/theme";
import { AlertScreen, ConfirmScreen, MenuScreen, PromptScreen } from "../shared/ui/OverlayHost";
import { navigationRef } from "./navigation-ref";

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
    Settings: SettingsNavigator,
    Alert: createNativeStackScreen({ screen: AlertScreen, options: overlayScreenOptions }),
    Confirm: createNativeStackScreen({ screen: ConfirmScreen, options: overlayScreenOptions }),
    Prompt: createNativeStackScreen({ screen: PromptScreen, options: overlayScreenOptions }),
    Menu: createNativeStackScreen({ screen: MenuScreen, options: overlayScreenOptions }),
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
