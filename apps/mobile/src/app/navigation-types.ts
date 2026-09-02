import type {
  OverlayAlertParams,
  OverlayConfirmParams,
  OverlayPromptParams,
} from "../shared/ui/OverlayHost";

export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  Project: { projectId: number };
  Alert: OverlayAlertParams;
  Confirm: OverlayConfirmParams;
  Prompt: OverlayPromptParams;
};

export type ProjectTabParamList = {
  Explorer: undefined;
  Editor: undefined;
  AI: undefined;
};
