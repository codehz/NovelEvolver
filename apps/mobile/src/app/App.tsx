import { StatusBar, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ProjectManagerProvider } from "../features/projects/ProjectManagerProvider";
import { SettingsLeaveBinder } from "../features/settings/use-settings-leave-guard";
import { OverlayHost } from "../shared/ui/OverlayHost";
import { RootNavigation } from "./navigation";

export function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        <ProjectManagerProvider>
          <OverlayHost>
            <SettingsLeaveBinder>
              <RootNavigation />
            </SettingsLeaveBinder>
          </OverlayHost>
        </ProjectManagerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
