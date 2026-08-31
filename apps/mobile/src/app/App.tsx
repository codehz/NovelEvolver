import { StatusBar, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ProjectManagerProvider } from "../features/projects/ProjectManagerProvider";
import { ConfirmHost } from "../features/settings/ConfirmHost";
import { RootNavigation } from "./navigation";

export function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        <ProjectManagerProvider>
          <ConfirmHost>
            <RootNavigation />
          </ConfirmHost>
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
