import type {
  OverlayAlertParams,
  OverlayConfirmParams,
  OverlayMenuParams,
  OverlayPromptParams,
} from "../shared/ui/OverlayHost";

export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  Project: { projectId: number };
  Alert: OverlayAlertParams;
  Confirm: OverlayConfirmParams;
  Prompt: OverlayPromptParams;
  Menu: OverlayMenuParams;
};
