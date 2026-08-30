import { useState } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { HomeScreen } from "../features/home/HomeScreen";
import { ConfirmHost } from "../features/settings/ConfirmHost";
import { SettingsScreen } from "../features/settings/SettingsScreen";

export function App() {
  const [route, setRoute] = useState<"home" | "settings">("home");

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <ConfirmHost>
        {route === "home" ? (
          <HomeScreen
            onOpenSettings={() => {
              setRoute("settings");
            }}
          />
        ) : (
          <SettingsScreen
            onBack={() => {
              setRoute("home");
            }}
          />
        )}
      </ConfirmHost>
    </SafeAreaProvider>
  );
}
