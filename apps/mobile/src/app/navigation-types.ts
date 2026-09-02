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

export type SettingsDetailStackParamList = {
  Empty: undefined;
  ProviderEditor: { id?: string };
  ModelEditor: { id?: string; providerId?: string };
  AgentEditor: { id?: string };
  PromptEditor: { id?: string };
  AiRuntimePolicy: undefined;
};
