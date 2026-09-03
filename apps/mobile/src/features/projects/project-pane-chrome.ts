import { StyleSheet } from "react-native";

import { color } from "../../shared/theme";

export const PROJECT_PANE_HEADER_HEIGHT = 64;

export const projectPaneStyles = StyleSheet.create({
  header: {
    height: PROJECT_PANE_HEADER_HEIGHT,
    backgroundColor: color.surface,
  },
});
